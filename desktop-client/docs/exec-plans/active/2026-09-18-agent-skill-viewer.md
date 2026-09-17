# Agent 视角实现计划

> **For agentic workers:** Use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在桌面客户端侧边栏新增「Agent 视角」一级导航，进入后先列出本机已安装的 agent，点击任一 agent 再展示该 agent 默认分发目录下的全部 SKILL，两级下钻，只读浏览。

**Architecture:** Renderer-only 变更，复用两条现有数据链路，不新增 IPC 通道、不新增后端接口、不改持久化。已安装 agent 列表来自 `AgentDetectionSnapshot.agentStatuses` 中 `installed === true` 的项；SKILL 归属来自 `LocalSkillsInventorySnapshot.rows` 每行的 `sourceAgents`，该字段按共享物理目标覆盖关系计算，因此天然符合「owned target + 共享路径标注」的决策。视图内部维护 `selectedAgentId`，属于 renderer 临时状态，不写入磁盘。

**Tech Stack:** React 18、TypeScript 5.6、Vite、Vitest、Testing Library、Electron renderer、lucide-react。

---

## Status

- Product spec: 已由 bicho 确认（2026-09-18），见 `docs/product-specs/2026-09-18-agent-skill-viewer.md`。
- Implementation plan: 本文件，2026-09-18 创建。
- Implementation: 进行中。

## Scope decomposition

1. 补齐 i18n 类型与中英文案。
2. 新增 `AgentSkillsView` 组件，承载两级结构与派生逻辑。
3. 侧边栏与 `App.tsx` 接入，包括进入视图时按需刷新库存。
4. 跑类型检查与测试，修复回归。
5. 更新架构文档并归档本计划。

不涉及：IPC 契约、后端接口、SQLite 持久化、agent adapter、分发与上传流程。

## File map

| File | Responsibility |
|------|----------------|
| `src/i18n/messages/types.ts` | 新增 `agentSkillsView` 文案类型块，`appShell.navigation` 增加 `agentSkills` |
| `src/i18n/messages/zh-CN.ts` | 中文文案 |
| `src/i18n/messages/en-US.ts` | 英文文案 |
| `src/components/agent-skills-view.tsx` | 新增：两级视图、agent 分组派生、目录状态、SKILL 列表与只读操作 |
| `src/components/app-shell.tsx` | `AppView` 增加 `agent-skills`，导航项增加「Agent 视角」与 Bot 图标 |
| `src/app/App.tsx` | `selectedAgentId` 状态、进入视图时刷新库存、顶部刷新覆盖新视图、渲染新分支 |
| `docs/ARCHITECTURE.md` | 记录新视图与派生规则 |
| `docs/exec-plans/active/index.md` | 实施期间登记本计划 |
| `docs/exec-plans/completed/index.md` | 归档后登记 |
| `task-tracker.md` | 完成记录 |

## Decisions locked by the approved spec

- 只显示默认分发目标（owned target）下的 SKILL，不展开 `compatibleReadPaths`。
- 共享物理目录按 `sourceAgents` 覆盖关系标注，同一目录在多个 agent 下出现属于预期结果。
- 已安装但没有有效 SKILL 目录的 agent 仍然显示，并用状态区分「目录为空」与「无分发目标」。
- SKILL 数量按 `validationState === "valid"` 的包根计数，与本地 SKILL 视图口径一致。
- v1 只读：支持打开 SKILL 所在目录，不含上传、删除、新增。
- 未安装 agent 不进入该视图，仍可在设置抽屉的 Agents 面板查看。
- 不新增 IPC 通道，不新增后台轮询，进入视图时按需刷新一次。

## Implementation tasks

### 1. i18n

- [ ] `types.ts` 增加 `appShell.navigation.agentSkills` 与 `agentSkillsView` 类型块。
- [ ] `zh-CN.ts` 与 `en-US.ts` 补齐中英文案，包含空状态、目录状态、数量统计。

### 2. AgentSkillsView 组件

- [ ] 定义 `AgentSkillEntry` 派生类型：agentId、displayName、targetPaths、rows、目录状态。
- [ ] 从 detection snapshot 取已安装 agent，从 inventory snapshot 按 `sourceAgents` 归集行。
- [ ] 第一级：卡片列表，展示显示名、有效 SKILL 数量、目录路径、共享提示、目录状态徽章。
- [ ] 第二级：返回栏、agent 标题、目录路径、SKILL 表格，每行支持打开所在目录。
- [ ] 空状态与加载态：无快照、无已安装 agent、目录为空、目录内无有效 SKILL。

### 3. 导航与状态接入

- [ ] `app-shell.tsx` 增加导航项与 Bot 图标。
- [ ] `App.tsx` 增加 `selectedAgentId`，进入视图时若库存为空则刷新。
- [ ] 顶部刷新按钮覆盖新视图。

### 4. 验证

- [ ] `npm run typecheck:electron` 通过。
- [ ] `npm test` 通过，无回归。

### 5. 文档与归档

- [ ] `docs/ARCHITECTURE.md` 记录新视图与派生规则。
- [ ] 归档本计划到 `completed/`，更新两个 index 与 `task-tracker.md`。

## Validation

- `npm run typecheck:electron`
- `npm test`

## Risks

- `sourceAgents` 依赖库存快照已加载，进入视图时必须保证刷新一次，否则第一级会显示「无 SKILL」。
- 若某 agent 的目录不可读，库存扫描可能不返回该行，此时该 agent 会显示为「目录为空」，需要在文案上与实际空目录区分或合并表述。
