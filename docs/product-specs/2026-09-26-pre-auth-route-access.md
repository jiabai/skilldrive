# Product Spec: Pre-Auth Route Access

Status: Draft for Review
Date: 2026-09-26

## User-Visible Goal

未登录用户可以正常打开登录前的认证页面。当前 `/login/ldap`（LDAP 登录页）与
`/login/sso/callback`（SSO 回调页）在匿名访问时会被强制跳转到 `/login`，这两个
页面因此实际不可用。

## Background

`AppShell` 用三个内联谓词决定渲染哪套外壳：

| 谓词 | 当前实现 |
|------|----------|
| `isAuthRoute` | `pathname === "/login" \|\| pathname === "/register"` |
| `isPublicRoute` | `pathname === "/" \|\| pathname === "/help"` |
| `isLandingRoute` | `pathname === "/"` |

`isAuthRoute` 用的是精确相等，`/login/` 下的子路由全部落空，掉进受保护分支。受保护
分支在没有 token 时执行 `router.replace("/login")`，于是：

- LDAP 登录页匿名访问被弹回 `/login`，用户点不到那个表单。
- SSO 回调页匿名访问同样被弹回 `/login`，回调带来的 token 片段无法落库。

`frontend/src/app/login/page.tsx` 的 LDAP 按钮实际跳转目标就是 `/login/ldap`，后端
`GET /api/v1/sso/callback` 成功与失败两种结局都回跳前端回调页，所以这两条路由是真实
存在且被引用的入口。

### 复现证据

在 `frontend/src/__tests__/` 下临时放置用例，令 `pathname` 为 `/login/ldap` 与
`/login/sso/callback`、清空 `skilldrive.tokens`，渲染 `<AppShell>` 并断言
`router.replace` 未被调用。运行 `npx vitest run` 得到：

```
AssertionError: expected "spy" to not be called at all, but actually been called 2 times
Received:
  1st spy call: [ "/login" ]
  2nd spy call: [ "/login" ]
```

两条路由均失败，与上面的根因分析一致。取证用例已删除。

## Scope

### In Scope

- 把认证路由判定从精确相等改成「`/register` 精确匹配，加上 `/login` 与其子路径」。
- 覆盖 `/login/ldap` 与 `/login/sso/callback` 两条具体路由。
- 补测试：两条路由匿名可渲染且不跳转，已登录时仍被送往 `/dashboard`。
- 复核 `frontend/src/app/login/sso/callback/page.tsx` 与 `AppShell` 的 effect 执行顺序，
  确认修好后回调链路不再依赖 effect 顺序。

### Non-Goals

- 不改后端 SSO 与 LDAP 实现，不改 `auth.py`、`sso_oidc.py`、`LDAPService`。
- 不改服务端能力开关，线上 `ENABLE_LDAP` 与 `ENABLE_SSO` 保持现状（均为 `false`）。
- 不改 nginx。ICP 补丁的排除规则 `^/(login|register)(/|$)` 已经覆盖这两条子路由。
- 不改 `/register` 的匹配方式，它没有子路由。
- 不重构 `AppShell` 的其余判定，不抽取新的路由谓词模块。
- 不改受保护路由集合，`/public-skills` 等仍要求登录。

## Affected Surfaces

| 表面 | 变更 |
|------|------|
| 组件 | `frontend/src/components/app/app-shell.tsx` 的 `isAuthRoute` 判定 |
| 测试 | `frontend/src/__tests__/app-shell-auth.test.tsx` 新增用例 |
| 文案 | 无，不涉及 i18n 词典 |
| 后端 | 无 |
| 部署 | 无，nginx 与 systemd 均不动 |

## Route Matrix After The Change

| 路由 | 匿名 | 已登录 | ICP 页脚 |
|------|------|--------|----------|
| `/` | 可访问 | 可访问 | 有 |
| `/help` | 可访问 | 可访问 | 有 |
| `/login` | 可访问 | 跳 `/dashboard` | 无 |
| `/login/ldap` | 可访问（本次修复） | 跳 `/dashboard` | 无 |
| `/login/sso/callback` | 可访问（本次修复） | 跳 `/dashboard` | 无 |
| `/register` | 可访问 | 跳 `/dashboard` | 无 |
| `/dashboard` 等控制台路由 | 跳 `/login` | 可访问 | 有 |

## Acceptance Criteria

1. 未登录状态下访问 `/login/ldap`，页面正常渲染，`router.replace` 不被调用。
2. 未登录状态下访问 `/login/sso/callback`，页面正常渲染，`router.replace` 不被调用。
3. SSO 回调页在 `/login/sso/callback` 上仍能读取 URL 片段里的 token、写入
   `skilldrive.tokens`、并跳转到 `/dashboard`，不依赖与 `AppShell` 的 effect 先后顺序。
4. 已持有有效 token 时访问 `/login/ldap`、`/login/sso/callback`、`/login`、`/register`，
   一律跳转到 `/dashboard`，行为与改动前一致。
5. 未登录访问 `/dashboard` 等控制台路由仍跳转 `/login`，回归不破坏。
6. 匿名访问 `/` 与 `/help` 仍不跳转，且 `/help` 仍显示 ICP 页脚。
7. 新增测试断言 1、2、4，并全部通过。
8. `next lint` 对改动文件零告警，`tsc --noEmit` 不新增错误。
9. `npm test` 全量通过。
10. 文档门禁 `python scripts/validate_agents_docs.py --level ERROR` 通过。

## Risks And Notes

- **这是一处潜伏缺陷，不是正在发生的线上故障。** 线上 `ENABLE_LDAP=false` 且
  `ENABLE_SSO=false`，`/login` 页面因此不渲染 LDAP 按钮，常规用户点不到这两条路由。
  缺陷只在直接输入 URL、或将来把开关打开时暴露。修复的价值在于开关一旦打开就能直接用。
- 改动落在认证路由判定上，属于 auth 语义范围，按 `WORKFLOW.md` 必须走 spec 与 plan
  门禁，不能按轻量路径处理。
- 匹配放宽到 `/login/` 前缀后，将来任何新增的 `/login/*` 页面默认都是登录前页面。
  这与 `frontend/src/app/login/` 目录的语义一致，属于期望的默认值。
- 不做的话，后果是 LDAP 与 SSO 两条登录通道在启用当天即不可用，且排查起来容易误判成
  后端问题。
