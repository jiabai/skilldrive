# Agent 视角 SKILL 删除实现计划

> **For agentic workers:** Use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在「Agent 视角」第二级的 SKILL 列表里，为每一行增加一个行操作菜单，删除入口置于展开区之内，使用普通二次确认，删除粒度限定为该行对应的单条物理路径。

**Architecture:** 主体是 renderer 接入。复用已有的 `local-skills:delete` IPC 通道、主进程 `deleteLocalSkillByRowKey`、`App.tsx` 的 `handleDeleteLocalSkill`、以及忙碌标记 `busyLocalSkillDeleteRowKey`。不新增 IPC 通道，不新增主进程删除逻辑，不改持久化。与「本地 SKILL」视图的唯一语义差异是调用时不传 `groupRowKeys`，因此只删除被点击那一行的物理路径，不做同名跨路径联动。

**Tech Stack:** React 18、TypeScript 5.6、Vitest、Testing Library、Electron renderer、既有 UI 原语（`Button`、`Badge`、`Card`、`Dialog`）。

---

## Status

- Product spec: 已由 bicho 确认（2026-09-18），见 `../../product-specs/2026-09-18-agent-skill-delete.md`。
- Interaction shape: 2026-09-18 追加决策。行操作采用「更多」菜单，展开形态选定为**行内展开**，不引入浮层。
- Implementation plan: 本文件，2026-09-18 创建，同日按上述交互决策修订。
- Implementation: 已完成（2026-09-18）。单文件测试 19 项全通过，构建通过，源码类型检查零错误。
- Remaining: 人工在真实窗口中确认展开区视觉与行高变化，确认后本计划归档生效。

## Scope decomposition

1. 补齐 i18n 类型与中英文案。
2. `AgentSkillsView` 增加行操作菜单、行内展开区、行级共享标记与确认弹窗。
3. 新增展开区样式。
4. `App.tsx` 接线，传入删除回调与忙碌标记。
5. 补测试，跑类型检查与测试。
6. 更新架构与安全文档，登记技术债，归档本计划。

不涉及：IPC 契约、主进程删除逻辑、后端接口、持久化、分发与上传流程、「本地 SKILL」视图的删除行为。

## File map

| File | Responsibility |
|------|----------------|
| `src/i18n/messages/types.ts` | `agentSkillsView` 块新增 9 个键 |
| `src/i18n/messages/zh-CN.ts` | 中文文案 |
| `src/i18n/messages/en-US.ts` | 英文文案 |
| `src/components/agent-skills-view.tsx` | 新增 props、行操作菜单按钮、行内展开区、行级共享标记、`expandedRowKey` 与 `pendingDeleteRow` 状态、确认弹窗 |
| `src/styles.css` | 新增 `update-item__expanded-actions` 与 `update-item__expanded-note`，并把展开区并入小屏响应式规则 |
| `src/app/App.tsx` | 向 `AgentSkillsView` 传 `deletingRowKey` 与 `onDelete` |
| `src/__tests__/agent-skills-view.test.tsx` | 更新 render helper 补 props，新增删除相关用例 |
| `docs/ARCHITECTURE.md` | 记录 Agent 视角的删除入口、交互形态与删除粒度 |
| `docs/SECURITY.md` | 补桌面端本地 SKILL 删除的规则与已知缺口 |
| `docs/exec-plans/tech-debt-tracker.md` | 登记包含性校验缺口（DC-006） |
| `docs/exec-plans/active/index.md` | 实施期间登记本计划 |
| `docs/exec-plans/completed/index.md` | 归档后登记 |

## Decisions locked by the approved spec

- 删除粒度为单条物理路径，即被点击行的 `packageRootPath`。调用 IPC 只传 `rowKey`，**不传 `groupRowKeys`**。
- 同名 SKILL 的其它副本保留，会继续显示在其它 agent 视图与「本地 SKILL」视图。
- 共享目录在展开区与确认弹窗中标注受影响 agent，只告知不拦截。
- 确认交互为普通二次确认，**不使用**「输入 SKILL 名称」的强确认。
- 保持永久删除，不引入回收站，弹窗文案写明不可撤销。
- 不改 IPC 契约，不改 `LocalSkillDeletePayload` 类型。
- 不新增主进程路径包含性校验，记为技术债 DC-006。

## Interaction decisions added 2026-09-18

- **行操作采用菜单形态。** 折叠态每行只显示【打开目录】与【更多】两个中性按钮，删除入口收进展开区。
- **展开形态为行内展开，不是浮层。** 点【更多】后该行在 header 下方长出一条操作区。
- **同时只展开一行。** 点开另一行时自动收起前一行。
- **删除按钮使用 `variant="destructive"`。** 与「本地 SKILL」视图行内按钮的 `secondary` 不一致，是本入口的有意取舍。

## 已核实的实现前提

- `App.tsx` 的 `handleDeleteLocalSkill(row, groupRowKeys?)` 可直接复用；省略第二个参数时主进程走单行分支。
- 忙碌标记复用 `busyLocalSkillDeleteRowKey`，两个视图不会同时可见，不会冲突。
- 主进程删除前会自行刷新快照并按 rowKey 查路径，renderer 不传绝对路径。
- `AgentSkillEntry` 与 `buildEntries` 未改动，删除后的重算由 props 中的新快照驱动。
- 项目没有下拉菜单、popover 或点击外部关闭的现成实现，因此不做浮层。
- `Button` 的 `variant` 取值为 `primary | secondary | outline | ghost | destructive | nav-active`。
- 行操作区样式在 `src/styles.css` 的 `.update-item__actions`，小屏响应式规则已一并覆盖展开区。

## Implementation tasks

### 1. i18n

- [x] `types.ts` 在 `agentSkillsView` 块末尾新增 9 个键。
- [x] `zh-CN.ts` 补齐中文，`deleteConfirmWarning` 写明永久删除且无法撤销。
- [x] `en-US.ts` 补齐英文。

### 2. AgentSkillsView 组件

- [x] props 新增 `deletingRowKey` 与 `onDelete`。
- [x] 内部状态新增 `expandedRowKey` 与 `pendingDeleteRow`，以及 `handleToggleExpanded`、`handleRequestDelete`、`handleConfirmDelete`、`handleCancelDelete`。
- [x] 行操作区在【打开目录】之后增加【更多】按钮，带 `aria-expanded`，文案在 `showMore` 与 `showLess` 之间切换。
- [x] 【更多】按钮在 `bridgeAvailable` 为假、或 `deletingRowKey` 非空时禁用。
- [x] 展开区紧跟 `update-item__header` 之后渲染，容器类名 `update-item__expanded-actions`。
- [x] 删除按钮 `variant="destructive"`；命中 `deletingRowKey` 时文案改为 `deleting` 且禁用。
- [x] `handleToggleExpanded` 展开目标行时同时收起其它行。
- [x] 共享行在展开区内显示共享标记，复用现有 `sharedWith` 文案，且排除当前 agent 自身。
- [x] 新增窄版确认弹窗：标题、描述、不可撤销警告与完整路径；共享时额外展示受影响 agent。
- [x] `handleConfirmDelete` 调用 `onDelete(pendingDeleteRow)` 后清空 `pendingDeleteRow`，保留 `expandedRowKey`。
- [x] 追加 effect：`expandedRowKey` 不再对应现存行时置为 `null`。

### 3. 样式

- [x] `styles.css` 新增 `update-item__expanded-actions` 与 `update-item__expanded-note`。
- [x] 展开区并入小屏响应式规则。
- [ ] 人工确认窄宽度下按钮不溢出（需真实窗口，见 Status 的 Remaining）。

### 4. App.tsx 接线

- [x] 传 `deletingRowKey={busyLocalSkillDeleteRowKey}`。
- [x] 传 `onDelete={handleDeleteLocalSkill}`，不额外包装。

### 5. 测试

- [x] `renderView` helper 支持覆盖参数并返回重渲染能力，既有 8 个用例继续通过。
- [x] 新增：默认状态下删除按钮不在文档中。
- [x] 新增：点【更多】后出现删除按钮，`aria-expanded` 为 `true`。
- [x] 新增：再点一次收起该行。
- [x] 新增：同时只展开一行。
- [x] 新增：展开区显示共享 agent。
- [x] 新增：点击删除弹出确认弹窗，展示 SKILL 名称与完整路径。
- [x] 新增：独占目录时弹窗不出现共享提示。
- [x] 新增：共享目录时弹窗出现共享提示并列出其它 agent。
- [x] 新增：确认后 `onDelete` 恰好被调用一次，且**调用参数长度为 1**。
- [x] 新增：取消不触发 `onDelete`。
- [x] 新增：`deletingRowKey` 命中时该行显示进行中文案且行操作禁用。
- [x] 新增：`bridgeAvailable` 为假时【更多】按钮禁用。

### 6. 文档与归档

- [x] `docs/ARCHITECTURE.md` 记录删除入口、菜单形态、删除粒度与视图差异。
- [x] `docs/SECURITY.md` 补桌面端本地 SKILL 删除规则与已知缺口。
- [x] `docs/exec-plans/tech-debt-tracker.md` 登记 DC-006。
- [x] 本计划归档到 `completed/`，更新两个 index。

## Validation

按 `docs/EXECUTION_GATES.md` 的 Desktop Client 与 Documentation 门禁执行。

实测结果（2026-09-18）：

```bash
cd desktop-client && npx vitest run src/__tests__/agent-skills-view.test.tsx   # 19 passed
cd desktop-client && npx vitest run                                            # 256 passed / 6 failed
cd desktop-client && npm run build                                             # typecheck:electron + vite 全部通过
cd desktop-client && npx tsc -p tsconfig.json --noEmit                         # 15 个错误，全在既有测试文件；源码零错误
python scripts/validate_agents_docs.py --level ERROR                           # 0 错误 / 10 警告
```

**全量测试的 6 个失败全部为既有问题，已用 HEAD 版本对照实验证实：**

- `skill-package-tree.test.ts` 与 `project-skill-import-service.test.ts` 各 1 个符号链接用例，本机 Windows 无法创建符号链接。
- `app.test.tsx` 4 个用例。把源码还原到 HEAD（不含本次任何改动）后重跑，**失败用例完全相同（4 failed / 49 passed）**，证明与本次改动无关。
- 其中 2 个的根因是提交 `1e533ef`（fix(i18n): update agentSkills label in English localization）把英文导航标签改成 "Agent" 却未同步更新 `app.test.tsx` 中的 `"Agent view"` 断言。

**src 类型检查的 15 个错误全部位于既有测试文件，非测试文件与本次改动文件均为零错误。**

## Risks

- **展开后删除按钮紧邻点击位置。** 折叠态误点风险已由菜单形态消除，但展开区出现后删除按钮就在刚才点击的手指下方。最后一道拦截是确认弹窗，实现时不得省略。
- **菜单里当前只有一项。** 为后续行操作预留位置是有意选择，界面评审时可能被质疑。
- **普通二次确认的护栏强度低于「本地 SKILL」视图。** 已知取舍，若出现误删再评估升级。
- **删除按钮样式与「本地 SKILL」视图不一致。** 本入口用 `destructive`，那个入口行内用 `secondary`，属有意视觉补偿。
- **共享目录只告知不拦截。** 影响面依赖弹窗与展开区文案的清晰度。
- **行内展开会改变行高。** 展开时后续内容整体下移，视觉跳动比浮层明显。这是已知代价。
- **`deletingRowKey` 非空时全局禁用行操作。** 用于避免并发删除请求，代价是一行在删时其它行也无法展开。

## Incident log

- 2026-09-18 18:51，为做对照实验执行 `git stash push`。该命令完成后触发的后台 `git gc` 在执行 `pack-refs` 与 `repack` 时被中断，`.git/refs` 整树与部分 `objects/pack` 文件被移入系统回收站，仓库一度报 `not a git repository`。已按 `recover-deleted-git-from-recycle-bin` 流程从回收站按原始路径回写 729 个条目并清理崩溃残留锁文件，`git fsck --full` 报告零缺失对象，历史完整。后续在本仓库避免使用 `git stash`。
