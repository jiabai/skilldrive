# Pre-Auth Route Access Plan

Status: Completed
Updated: 2026-09-26

Spec: `docs/product-specs/2026-09-26-pre-auth-route-access.md`
Archived: 2026-09-26

## Purpose / Big Picture

修掉 `AppShell` 认证路由判定的精确匹配缺陷，让 `/login/ldap` 与 `/login/sso/callback`
能被未登录用户访问，同时不改变任何现有跳转行为。

改动实质是一行判定加一组测试，风险集中在「放宽匹配是否误伤受保护路由」。

## Root Cause

`frontend/src/components/app/app-shell.tsx` 第 43 行：

```ts
const isAuthRoute = pathname === "/login" || pathname === "/register"
```

精确相等使 `/login/ldap` 与 `/login/sso/callback` 同时不满足 `isAuthRoute` 与
`isPublicRoute`，落入受保护分支。该分支在无 token 时执行 `router.replace("/login")`。

## Planned Change

```ts
const isAuthRoute =
  pathname === "/register" || pathname === "/login" || pathname.startsWith("/login/")
```

保留 `/login` 的精确匹配，只把 `/login/` 前缀纳入进来，避免误吃假设存在的
`/loginxxx` 这类同级路径。`/register` 无子路由，维持精确匹配。

选择内联而不抽取独立谓词模块：改动只有一行，`AppShell` 里另外两个谓词
（`isPublicRoute`、`isLandingRoute`）不需要同步，抽模块属于非必要抽象。

## Order Of Work

1. 在 `frontend/src/__tests__/app-shell-auth.test.tsx` 新增失败用例，覆盖 spec 的验收
   标准 1、2、4，先确认它们在改动前失败。
2. 改 `app-shell.tsx` 的 `isAuthRoute`，只动这一行。
3. 重跑用例，确认转绿。
4. 跑受影响的完整测试文件与全量 `npm test`，确认无回归。
5. 跑 `next lint` 与 `tsc --noEmit`。
6. 跑文档门禁 `python scripts/validate_agents_docs.py --level ERROR`。
7. 更新 `docs/product-specs/index.md` 与 `docs/exec-plans/active/index.md`。
8. 提交到本地 `main`，不推送。
9. 把 plan 归档到 `docs/exec-plans/completed/` 并更新两个 index。

## Key Files

- `frontend/src/components/app/app-shell.tsx`（第 43 行，唯一产品代码改动）
- `frontend/src/__tests__/app-shell-auth.test.tsx`（新增用例）
- `frontend/src/__tests__/sso-callback.test.tsx`（不改，用作回归参照）

## Validations

```bash
cd frontend && npx vitest run src/__tests__/app-shell-auth.test.tsx src/__tests__/sso-callback.test.tsx src/__tests__/pages.test.tsx
cd frontend && npm test
cd frontend && npx next lint --file src/components/app/app-shell.tsx --file src/__tests__/app-shell-auth.test.tsx
cd frontend && npx tsc --noEmit
python scripts/validate_agents_docs.py --level ERROR
```

`tsc --noEmit` 目前有两条既有错误（`skill-visibility.test.ts`、`user-status.test.ts`），
与本改动无关，验收标准是「不新增」。

`npm run build` 在 `EXECUTION_GATES.md` 里对「影响路由」的改动是要求跑的。本次改的是
客户端路由判定，不在 Next.js 构建期生效，但按门禁口径应跑一次。

本机执行时遇到两个环境层阻碍，均已解决，最终构建通过：

1. 沙箱拒绝写 `frontend/.next/trace`，构建进程起不来。
2. WorkBuddy 的删除保护拦截 Next 清空 `.next`（`SAFE_DELETE_BULK_CONFIRM_REQUIRED`，
   按轮次累计，阈值 50，而 Next 每次构建要删 2000 个以上文件）。经用户确认后，仅对
   这一次构建把 `CODEBUDDY_SAFE_DELETE_BULK_THRESHOLD` 调高；删除保护本身仍生效，
   且本次构建删除的全部内容都在 gitignored 的 `frontend/.next` 内。

## Decisions To Track

- **是否把 `/help` 的子路径一并处理**：`isPublicRoute` 同样是精确匹配，但 `/help` 当前
  没有子路由，属于假想问题，本次不动，避免超出修复范围。
- **是否顺手改 `/login/sso/callback` 的 effect 竞态**：不做。修好 `isAuthRoute` 之后
  `AppShell` 不会再对该路由发起跳转，竞态的前提消失，无需额外改动。
- **是否补一条「所有 `/login/*` 均为登录前路由」的守卫测试**：倾向补一条基于具体路由
  的用例即可，不引入目录扫描式测试。

## Progress

- [x] 完成根因取证，两条路由复现失败，取证用例已删除。
- [x] 产出 spec 与 plan。
- [x] spec 与 plan 经用户评审批准。
- [x] 补失败用例。改代码前 3 条新用例全红，`app-shell-auth.test.tsx` 10 项中 3 项失败。
- [x] 改 `isAuthRoute`。转绿，该文件 13 项全过。
- [x] 跑前端门禁。受影响测试文件 40 项全过；全量 `vitest run` 12 文件 67 项全过；
      受影响文件 lint 零告警；`tsc --noEmit` 无新增错误；`next build` 通过。
- [x] 跑文档门禁，0 错误、0 新增警告。
- [x] 提交并归档。

## Outcome

已完成。

改动落点是一行判定：

```ts
const isAuthRoute =
  pathname === "/register" || pathname === "/login" || pathname.startsWith("/login/")
```

测试从 10 项增至 13 项，新增 3 条覆盖 `/login/ldap` 与 `/login/sso/callback` 的匿名
可渲染性，以及已登录访问 `/login/ldap` 仍跳 `/dashboard`。

验证结果：

| 门禁 | 结果 |
|------|------|
| 受影响测试文件 | 40 项全过 |
| 全量 `vitest run` | 12 文件 67 项全过 |
| `next lint` | 零告警 |
| `tsc --noEmit` | 仅两条既有错误，无新增 |
| `next build` | 通过，19 条路由，`/login/ldap` 与 `/login/sso/callback` 均在清单内 |
| 文档门禁 | 0 错误，0 新增警告 |

残余风险与后续：

- 线上 `ENABLE_LDAP=false`、`ENABLE_SSO=false`，本次修复不改变任何线上行为。真正生效要
  等把开关打开并把 frontend 重新发布。
- 发布 frontend 时，nginx 里标注 `ICP-PATCH` 的行必须一并删除，否则源码页脚与 nginx
  注入叠加，首页会出现两个备案号。定位命令：
  `grep -n "ICP-PATCH" /etc/nginx/conf.d/8xf-pro.conf`。这条与本次修复没有依赖关系，
  只是因为两者都改到 `AppShell`，一并留档。
- `/help` 的子路径未纳入本次范围，`isPublicRoute` 仍是精确匹配，当前 `/help` 没有子路由，
  属于假想问题。
