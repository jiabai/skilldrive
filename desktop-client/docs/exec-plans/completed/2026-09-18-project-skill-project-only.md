# 项目详情只显示项目内 SKILL 实现计划

> **For agentic workers:** Use checkbox (`- [x]`) syntax for tracking.

**Goal:** 把「项目详情」的技能列表收窄为只显示项目根目录内扫到的 SKILL，移除对 `~/.agents/skills` 全局技能行的合并。

**Architecture:** 改动集中在主进程扫描服务与其调用点。`project-skill-scan-service.ts` 删除 global 行构造，`ProjectSkillScanInput` 不再接收全局库存快照，`electron/main.ts` 的项目扫描不再额外刷新本地技能库存。类型层收窄 `ProjectSkillSource` 与 `ProjectSkillRow.relativePath`，renderer 只做最小适配。IPC 通道名、项目存储、导入流程、项目目标目录清单均不变。

**Tech Stack:** TypeScript 5.6、React 18、Electron main、Vitest、Testing Library。

---

## Status

- Product spec: 已由 bicho 确认（2026-09-18），见 `../../product-specs/2026-09-18-project-skill-project-only.md`。
- Implementation plan: 本文件，2026-09-18 创建。
- Implementation: 已完成（2026-09-18）。扫描服务、类型、Electron 调用点、renderer 与 i18n 全部改完，构建通过。
- Remaining: 人工在真实窗口中确认项目详情列表不再出现全局行。

## Scope decomposition

1. 扫描服务与共享类型收窄。
2. Electron 调用点与 i18n 文案。
3. renderer 行渲染最小适配。
4. 单元测试与 renderer 测试更新。
5. 跑桌面端与文档门禁。
6. 更新架构、参考、设计文档，标记被取代的旧规格，归档本计划。

不涉及：Local Skills 全局库存的刷新、上传与删除；导入流程与路径安全；`config/projects.json`；IPC 通道名与 payload 形状；Agent 视角视图。

## File map

| File | Responsibility |
|------|----------------|
| `src/core/projects/project-skill-scan-service.ts` | 删除 `createGlobalRows`、`isPathInside`、`homeDir` 选项；`ProjectSkillScanInput` 去掉 `globalSnapshot` |
| `src/types/index.ts` | `ProjectSkillSource` 收窄为仅 `project`；`ProjectSkillRow.relativePath` 收窄为 `string` |
| `electron/main.ts` | `scanProjectSkillsById` 不再调用 `refreshLocalSkillsSnapshot()` |
| `src/components/projects-view.tsx` | 来源徽标 tone 固定为 `accent`；路径改为直接读 `row.relativePath` |
| `src/i18n/messages/types.ts` | `projectsView.sourceLabels` 删除 `global` 键 |
| `src/i18n/messages/zh-CN.ts` | 删除「全局」文案 |
| `src/i18n/messages/en-US.ts` | 删除 "Global" 文案 |
| `src/__tests__/project-skill-scan-service.test.ts` | 删除全局库存 fixture 与相关断言，用例改为「只扫项目行」 |
| `src/__tests__/app.test.tsx` | mock 快照去掉 global 行，删除 `global-only` 与 `Global` 断言 |
| `docs/product-specs/2026-05-07-project-skill-loading.md` | 标记全局合并一节被取代 |
| `docs/design-docs/project-skill-loading.md` | 更新扫描步骤与数据模型描述 |
| `docs/ARCHITECTURE.md` | 更新项目详情扫描范围描述 |
| `docs/references/runtime-and-storage-surface.md` | 删除全局行合并说明 |
| `docs/exec-plans/active/index.md` | 实施期间登记本计划 |
| `docs/exec-plans/completed/index.md` | 归档后登记 |

## Decisions locked by the approved spec

- 移除的是「全局行合并」，不是「项目级 `.agents/skills` 目标」。项目内 `.agents/skills` 继续参与扫描，Cline、Codex、Warp、OpenCode 的共享去重逻辑不变。
- `ProjectSkillScanInput` 直接去掉 `globalSnapshot` 字段，不保留空占位参数，避免留下死参数。
- `ProjectSkillSource` 收窄为单值联合 `"project"`，保留 `source` 字段本身，使 IPC 快照形状保持稳定，将来新增来源时不必再改快照结构。
- 主进程项目扫描不再刷新本地技能库存。这同时去掉了一次与项目无关的全盘扫描，属于附带收益，但它是移除合并的必然结果，不是独立优化目标。
- UI 的来源徽标保留显示，文案仍走 `sourceLabels`，只是取值只剩「项目」。

## 已核实的实现前提

- `ProjectSkillRow` 的构造点只有 `project-skill-scan-service.ts` 与 `app.test.tsx` 的 mock 快照，收窄 `relativePath` 不会波及其他模块。
- `relativePath: null` 的唯一来源是 `createGlobalRows`，项目行恒有相对路径，因此收窄为 `string` 是准确的。
- `createGlobalRows` 是 `isPathInside` 与 `homeDir` 选项的唯一使用者，三者可一并删除。
- `electron/main.ts` 的 `refreshLocalSkillsSnapshot` 仍被 `refreshLocalSkills` 通道使用，不能整体删除，只能去掉项目扫描这条调用。
- renderer 侧只有 `projects-view.tsx` 读取 `row.source` 与 `row.relativePath`。
- i18n 的 `sourceLabels` 只被 `projects-view.tsx` 使用，`config-status.tsx` 用的是另一组同名字段。

## Implementation tasks

### 1. 扫描服务

- [x] 删除 `createGlobalRows` 函数与 `isPathInside` 辅助函数。
- [x] `ProjectSkillScanServiceOptions` 删除 `homeDir`，删除 `homedir` 导入。
- [x] `ProjectSkillScanInput` 只保留 `project`，删除 `LocalSkillsInventorySnapshot` 导入。
- [x] 项目路径不可读的提前返回分支，`rows` 改为空数组。
- [x] 正常返回的 `rows` 改为 `sortProjectRows(projectRows)`，不再拼接全局行。

### 2. 共享类型

- [x] `ProjectSkillSource` 收窄为 `"project"`。
- [x] `ProjectSkillRow.relativePath` 改为 `string`。

### 3. Electron 调用点

- [x] `scanProjectSkillsById` 删除全局库存刷新调用与 `console.warn` 兜底，直接以 `{ project }` 调用扫描服务。

### 4. Renderer 与文案

- [x] `projects-view.tsx` 徽标 tone 直接写 `"accent"`，路径改为 `copy.path(row.relativePath)`。
- [x] i18n 三份文件删除 `sourceLabels.global`。

### 5. 测试

- [x] `project-skill-scan-service.test.ts` 删除 `createGlobalSnapshot` 与 `LocalSkillsInventorySnapshot` 导入。
- [x] 首个用例改名并改为只断言项目行，参数改为 `scan({ project })`。
- [x] 其余两个用例的参数同步去掉 `globalSnapshot`。
- [x] `app.test.tsx` 的 `defaultProjectScanSnapshot.rows` 删除 global 行。
- [x] 项目详情用例删除 `global-only` 文本断言与 `Global` 徽标断言，保留 `Project` 断言。

### 6. 文档、门禁与归档

- [x] 更新 `docs/product-specs/2026-05-07-project-skill-loading.md`，注明全局合并被本规格取代。
- [x] 更新 `docs/design-docs/project-skill-loading.md` 的输入、扫描步骤与数据模型。
- [x] 更新 `docs/ARCHITECTURE.md` 与 `docs/references/runtime-and-storage-surface.md`。
- [x] 在 `docs/exec-plans/active/index.md` 登记本计划，完成后移入 `completed/` 并更新两个索引。
- [x] 跑完 Validation 一节的全部命令并回填实测结果。

## Validation

按 `docs/EXECUTION_GATES.md` 的 Desktop Client 与 Documentation 门禁执行：

```bash
cd desktop-client && npx vitest run src/__tests__/project-skill-scan-service.test.ts
cd desktop-client && npx vitest run src/__tests__/app.test.tsx
cd desktop-client && npm test
cd desktop-client && npm run build
cd desktop-client && npx tsc -p tsconfig.json --noEmit
python scripts/validate_agents_docs.py --level ERROR
git diff --check
```

实测结果（2026-09-18）：

```bash
cd desktop-client && npx vitest run src/__tests__/project-skill-scan-service.test.ts   # 3 passed
cd desktop-client && npx vitest run src/__tests__/app.test.tsx -t "opens a project detail view"  # 1 passed
cd desktop-client && npm run build                                                    # typecheck:electron + vite 全部通过
python scripts/validate_agents_docs.py --level ERROR                                  # 0 错误 / 10 警告
git diff --check                                                                      # 无空白错误
```

全量 `npm test` 结果为 6 failed / 256 passed，失败集合与改动前完全一致：

- `skill-package-tree.test.ts` 与 `project-skill-import-service.test.ts` 各 1 个符号链接用例。本机 Windows 无权限创建符号链接，属环境既有失败，且这两个文件本轮未改动。
- `app.test.tsx` 4 个用例。已用独立基线对照确证为既有失败：用 `git worktree add --detach HEAD` 在提交 `1e533ef` 上检出干净工作树，通过目录联接复用 `node_modules` 后运行同一测试文件，得到**完全相同的 4 failed / 49 passed 与相同的失败用例名**。对照结束后已删除联接与工作树，`git worktree list` 只剩主工作树。
- 其中 2 个失败的根因是提交 `1e533ef` 把英文导航标签改成 "Agent" 却未同步更新 `app.test.tsx` 的 "Agent view" 断言；另 1 个是 Local Skills 上传冲突的预期调用次数不符。
- 本轮修改过的 "opens a project detail view and imports a validated project skill" 在单独运行时通过，在全量运行时失败，属同文件内的用例间状态污染，与本次改动无关。

## Risks

- **项目详情与 Local Skills 会出现同名 SKILL。** 这是本改动的直接后果，也是用户要求的结果。界面评审时需要确认不会被视为重复。
- **`source` 字段变成单值联合。** 类型上略显冗余，是为保持 IPC 快照形状稳定而付出的代价。
- **少一次全局库存刷新会改变项目打开的速度表现。** 只会更快，不会更慢，但若将来有其它逻辑依赖该副作用，需要重新评估。当前没有这种依赖。
- **全量测试存在既有失败。** 按上一条计划的实测记录，`app.test.tsx` 与符号链接相关用例在本机已有既有失败，需在本次收尾时用对照方式确认失败集合没有扩大。
