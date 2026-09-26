# Pre-Auth Route Access Tasks

Companion plan: `../completed/pre-auth-route-access-plan.md`
Spec: `docs/product-specs/2026-09-26-pre-auth-route-access.md`
Status: Completed

## Task Checklist

- [x] **T1 补失败用例**
  - 文件：`frontend/src/__tests__/app-shell-auth.test.tsx`
  - 内容：三条用例。`/login/ldap` 匿名可渲染且 `router.replace` 未被调用；`/login/sso/callback` 同上；`/login/ldap` 持有有效 token 时跳 `/dashboard`。
  - 校验：`npx vitest run src/__tests__/app-shell-auth.test.tsx`，确认新用例在改代码前失败。
  - 依赖：无。

- [x] **T2 改认证路由判定**
  - 文件：`frontend/src/components/app/app-shell.tsx` 第 43 行。
  - 内容：`isAuthRoute` 改为 `/register` 精确匹配加 `/login` 与其子路径前缀匹配。只动这一行。
  - 校验：`npx vitest run src/__tests__/app-shell-auth.test.tsx`，T1 用例转绿。
  - 依赖：T1。

- [x] **T3 回归受影响的测试文件**
  - 文件：不改代码，只跑测试。
  - 校验：`npx vitest run src/__tests__/app-shell-auth.test.tsx src/__tests__/sso-callback.test.tsx src/__tests__/pages.test.tsx`。
  - 依赖：T2。

- [x] **T4 全量前端测试**
  - 校验：`npm test`。
  - 依赖：T3。

- [x] **T5 静态检查**
  - 校验：`npx next lint --file src/components/app/app-shell.tsx --file src/__tests__/app-shell-auth.test.tsx`；`npx tsc --noEmit` 相对基线不新增错误。
  - 依赖：T2。

- [x] **T6 文档门禁**
  - 校验：`python scripts/validate_agents_docs.py --level ERROR`，要求 0 错误。
  - 依赖：spec 与 plan 已就位。

- [x] **T7 提交**
  - 内容：提交到本地 `main`，不推送。提交信息沿用 `fix(frontend): ...` 风格。
  - 依赖：T4、T5、T6。

- [x] **T8 归档 plan**
  - 内容：plan 与 tasks 一并移到 `docs/exec-plans/completed/`，更新两个 index 的表格，回填 plan 的 Outcome。
  - 依赖：T7。

## Notes

- T7 之前不要动线上。本次是纯前端源码修复，线上跑的是 6 月 15 日构建产物，与本次改动无冲突，也不需要重新部署。
- T5 的基线错误是 `skill-visibility.test.ts` 与 `user-status.test.ts` 两条既有错误，与本改动无关。
- `npm run build` 按 `EXECUTION_GATES.md` 对路由类改动是应跑的，若因本机历史环境问题卡住，按 plan 的 Validations 一节记录后绕行，不阻塞 T7。
