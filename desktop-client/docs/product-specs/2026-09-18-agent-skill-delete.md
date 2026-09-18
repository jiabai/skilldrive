# Agent 视角：删除单个 SKILL

> 状态：已确认（2026-09-18，bicho 确认四项决策）。
> 本文档定义需求与已确认决策，实现细节见执行计划 `../exec-plans/2026-09-18-agent-skill-delete.md`（规格获批后创建）。
> 本规格是 `2026-09-18-agent-skill-viewer.md` 问题 4 选项 C 的独立落地。原规格明确把「删除本地 SKILL」列为破坏性操作，要求独立设计确认流程，本文档即该流程的设计。

## 一、需求复述

1. 在「Agent 视角」的第二级页面，也就是某个 agent 的 SKILL 列表里，为每一条 SKILL 增加删除入口。
2. 删除用于清理无用的 SKILL，让整理动作可以在「先选 agent 再看清单」的视角下完成，不必切到「本地 SKILL」视图。

一句话概括：把已经存在的删除能力，接入 Agent 视角的单行操作区，并为它设计一套与破坏性程度匹配的确认流程。

## 二、与现有功能的关系

删除能力已经全链路存在，本次是接入而不是新建。实测分布如下。

| 层 | 位置 | 现状 |
|---|---|---|
| IPC 通道 | `electron/ipc.ts` 的 `local-skills:delete` | 已存在，注册在 `desktopClientIpcChannels.deleteLocalSkill` |
| 主进程实现 | `electron/main.ts:582` 的 `deleteLocalSkillByRowKey` | 已存在，逐行 `rm(packageRootPath, { recursive: true, force: true })` |
| 类型 | `src/types/index.ts` 的 `LocalSkillDeletePayload` | `rowKey` 必填，`groupRowKeys` 可选 |
| 桥接 | `electron/preload.ts`、`src/lib/ipc-client.ts` | 已存在，`invokeDeleteLocalSkill` |
| 确认交互 | `src/components/local-skills-view.tsx:429` | 已存在，强制输入 SKILL 名称的窄弹窗 |
| 状态与提示 | `src/app/App.tsx` 的 `handleDeleteLocalSkill` | 已存在，含忙碌标记、成功与失败活动流提示、失败后刷新 |

因此本次不新增 IPC 通道，不新增主进程删除逻辑，不改持久化，改动集中在 renderer 接入与文案。

## 三、实现前必须知道的既有事实

这部分是实测结论，直接影响删除语义是否安全，实现时不要凭印象假设。

1. **该视图的每一行都落在该 agent 自己的目标目录内。** 库存扫描只遍历 `snapshot.uniqueTargets`（`src/core/local-skills/local-skill-inventory-service.ts:401`），而 `uniqueTargets` 只由各 agent 的 owned targetPath 去重构成（`src/core/detection/agent-detection-service.ts:192` 至 `226`，以及 `241` 至 `248`）。`compatibleReadPaths` 只挂在 agent 状态上，不参与 `uniqueTargets`。所以在某个 agent 下删除，不会伸手删到别的 agent 独占的目录。
2. **共享目录在库存里只出现一次。** `uniqueTargets` 按物理路径去重，因此 Codex、Cline、Warp 共用的 `~/.agents/skills` 只有一个 target，行上的 `sourceAgents` 就是 `coveredAgentIds` 全集。这是「同一行被多个 agent 看到」的成因。
3. **删除是永久删除。** 主进程用 `rm` 加 `recursive` 与 `force`，没有回收站，没有撤销。`force` 还意味着路径已不存在时静默成功。
4. **主进程删除前会重新扫描。** `deleteLocalSkillByRowKey` 自己先刷新快照，再按 rowKey 查路径，不信任 renderer 传来的绝对路径，只接受 rowKey。
5. **主进程对 `packageRootPath` 没有包含性校验。** `SECURITY.md` 对 CLI 覆盖删除要求「在确认目标位于所选目标根之内后再删除」，桌面端的本地 SKILL 删除目前没有对应约束。这是既有缺口，本次不扩大范围，记为技术债，见第八节。

## 四、已确认的决策

四项决策于 2026-09-18 由 bicho 确认。每项后面附上由该决策推出的实现细则，细则部分是为了消掉歧义，实现时按细则执行。

### 决策 1：删除范围为「只删该 agent 这一份」

细则：

- 删除粒度是**单条物理路径**，即被点击那一行对应的 `packageRootPath`。
- 调用 IPC 时只传 `rowKey`，**不传 `groupRowKeys`**。这是与「本地 SKILL」视图唯一的语义差异，那个视图按 SKILL 名称联动删除全部副本。
- 由此推出的预期结果：同一个 SKILL 若在该 agent 的多个 target 下各有副本，其余副本保留并继续显示；若在其它 agent 目录下还有副本，那些副本也不受影响，并且仍会出现在「本地 SKILL」视图里。
- 不提供「按名称清空全部副本」的选项。

### 决策 2：共享物理目录提示影响面后照删

细则：

- 判定条件用 `row.sourceAgents.length > 1`。
- 行上增加共享标记，与第一级已有的共享提示口径保持一致。
- 确认弹窗在判定为共享时，列出将受影响的所有 agent 显示名，取 `row.sourceDisplayNames`。
- 只做告知，不做拦截。用户确认后照常删除。

### 决策 3：确认交互用普通二次确认

细则：

- **不复用**「本地 SKILL」视图那种强制输入 SKILL 名称的确认方式。
- 弹窗内容包含：SKILL 名称、将删除的完整 `packageRootPath`、受影响 agent（仅共享时）、不可撤销警告、取消与确认两个按钮。
- 确认按钮使用破坏性样式，取消为次要样式。
- 文案明确写出不可撤销，因为决策 4 保持永久删除。

### 决策 4：保持永久删除

细则：

- 复用现有 `rm` 逻辑，不引入回收站，不引入备份。
- 弹窗警告文案与「本地 SKILL」视图的实际后果保持一致，都写明从磁盘永久删除且无法撤销。
- 改为移入系统回收站列为后续可选改进，见第八节。

## 五、受影响界面

### 5.1 第二级 SKILL 列表的行操作区

- 在现有校验状态徽章与【打开所在目录】之外，增加【删除】按钮。
- 按钮为次要或破坏性样式，尺寸与相邻按钮一致。
- 删除进行中，该行按钮显示进行中文案并禁用，避免重复提交。
- SKILL 位于共享目录时，本行增加共享标记。

### 5.2 新增的确认弹窗

- 窄版弹窗，标题为删除 SKILL。
- 正文展示将删除的完整路径。
- 共享场景额外展示受影响的 agent 列表。
- 底部为取消与确认两个操作。

### 5.3 不改动的界面

- 第一级 agent 列表及其计数。
- 「本地 SKILL」视图的列表、分组与删除行为。
- 设置抽屉中的 Agents 面板。

## 六、非目标

- 不做撤销、回收站、批量删除、多选删除。
- 不支持按 SKILL 名称删除全部副本。
- 不新增 IPC 通道，不修改 `LocalSkillDeletePayload` 类型。
- 不新增主进程路径包含性校验。
- 不改变第一级 agent 列表的排序与计数口径。
- 不改变「本地 SKILL」视图按名称联动删除的现有语义。
- 不改变分发、上传、审批流程。
- 不改变后端契约。

## 七、验收标准

1. 第二级的每一条 SKILL 都有删除入口。
2. 点击删除后弹出确认弹窗，弹窗展示 SKILL 名称与完整 `packageRootPath`。
3. SKILL 位于共享目录时，弹窗列出全部受影响 agent；位于独占目录时不显示该提示。
4. 确认删除后该行从列表消失，第二级计数同步减少，第一级该 agent 的有效 SKILL 数量同步减少，无需手动刷新。
5. 删除只影响被点击那一行的物理路径。同名 SKILL 的其它副本仍在磁盘上，并在其它 agent 视图与「本地 SKILL」视图中正常显示。
6. 点击取消不产生任何磁盘改动。
7. 删除进行中，该行删除按钮禁用并显示进行中状态，重复点击不会产生第二次删除。
8. 删除失败时列表回到与磁盘一致的状态，并出现失败提示。
9. 中英文案齐全，切换语言后无缺失或回退。
10. 现有「本地 SKILL」视图的删除、上传行为不退化。
11. 侧边栏其余视图与导航行为不退化。

## 八、风险与待跟踪

以下三条在本次范围内不处理，记录在案。

1. **主进程缺少包含性校验。** `deleteLocalSkillByRowKey` 直接对被扫描出的 `packageRootPath` 调用 `rm`。由于 agent 路径可由 `config/agent-paths.json` 自定义，理论上可配置出过度宽泛的目标根。这与 `SECURITY.md` 对 CLI 覆盖删除的要求不一致。建议在 `docs/exec-plans/tech-debt-tracker.md` 中登记，后续统一补校验，并让两个删除入口共用同一道检查。
2. **共享目录删除靠文案告知，没有硬性拦截。** 若后续反馈误删共享 SKILL 的成本偏高，可改为禁止在此删除并引导到「本地 SKILL」视图，或增加「仅从该 agent 视角隐藏」的软方案。
3. **行内入口提高了操作频率，护栏强度低于「本地 SKILL」视图。** 决策 3 选择普通二次确认，是有意为之的取舍。若出现误删，再评估是否升级为输入名称确认。

## 九、参考

- 上游规格与本次的来源：`2026-09-18-agent-skill-viewer.md`
- 删除能力与分组语义：`2026-05-01-local-skills-management-zh.md`
- agent 目标与共享路径模型：`2026-04-23-agents-skill-paths.md`
- 架构：`../ARCHITECTURE.md`
- 安全：`../SECURITY.md`
