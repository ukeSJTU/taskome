# apps/web 既有代码架构一致性审查

审查范围：`apps/web/src/**`（app/、components/、lib/）。对照 `docs/adr/0012-web-bff-gateway-data-ownership.md`（RSC/Server Action 直连 gateway 适配层，Route Handler 是浏览器可见的 BFF 边界）与 `docs/adr/0018-public-website-in-apps-web-with-locale-routing.md`（`(app)`/`(auth)`/`(public)` 三个路由分组、`next-intl` 语言前缀路由）。本文档只列发现，不做重构方案设计。

---

## 发现 1：`(app)/dashboard` 页面几乎全部是未替换的 shadcn `dashboard-01` 模板占位内容

- **位置**：
    - `apps/web/src/components/section-cards.tsx`（"Total Revenue $1,250.00"、"Acme Inc." 式的假 KPI 卡片）
    - `apps/web/src/components/chart-area-interactive.tsx`（276 行，模板自带的面积图，无真实数据源）
    - `apps/web/src/components/data-table.tsx`（810 行，模板自带的表格组件）
    - `apps/web/src/app/(app)/dashboard/data.json`（614 行静态假数据，字段为 `"header": "Cover page"`、`"reviewer": "Eddie Lake"` 等与 Taskome 业务（Job/Task/PepMimic/BindCraft/GraphPep）完全无关的示例内容）
    - `apps/web/src/components/app-sidebar.tsx:35-145`：`data.navMain`/`navClouds`/`navSecondary`/`documents` 硬编码为 "Lifecycle"、"Analytics"、"Capture"、"Word Assistant" 等模板导航项，所有 `url` 均为 `"#"` 死链接；`app-sidebar.tsx:162` 品牌名硬编码为 `"Acme Inc."`
    - `apps/web/src/components/nav-documents.tsx`：整个 "Documents" 分组（Open/Share/Delete 下拉菜单）是模板自带的文档管理 UI，与当前产品域（Job 管理平台）无关
- **为什么是问题**：commit `29616b0`（"feat(web): add authenticated dashboard shell via shadcn dashboard-01"）的信息明确说明这是"as the real /dashboard page"（视为正式页面，而非临时占位），且只把登录用户信息接了进去（sidebar 头像/用户名），其余内容（KPI、图表、表格、导航项）都还是模板原始假数据。这不是 ADR 层面的越界问题，而是 AGENTS.md 中"Cleanup: Remove outdated code paths instead of maintaining old behavior"原则下的模板残留：这些组件目前既不反映 Taskome 的真实功能面（Job 列表、Task 类型等），也没有任何注释/issue 标记它们是临时的。后续任何人接手 dashboard 迭代都可能误以为这是需要保留的设计基线。
- **严重程度**：应尽快重构（should refactor soon）。不阻塞当前的架构设计讨论，但在下一次实现真实 dashboard 功能之前，应该被识别为"整体替换"而非"局部修改"的对象，以免有人在假数据结构上继续叠加真实字段。

---

## 发现 2：`AppSidebar` 的 `NavUser` 下拉菜单里的操作项完全没有绑定行为，"Log out" 点了没反应

- **位置**：`apps/web/src/components/nav-user.tsx:76-93`
    - `DropdownMenuItem` 的 "Account"、"Billing"、"Notifications"、"Log out" 四项均无 `onClick`，`Log out` 没有调用 `authClient.signOut()`。
- **对照**：同一代码库中已经存在正确实现的登出逻辑——`apps/web/src/components/user-menu.tsx:43-53`（公共站点 header 里的 `UserMenu` 组件）正确调用了 `authClient.signOut({ fetchOptions: { onSuccess: () => router.push("/") } })`。
- **为什么是问题**：这不是架构边界问题，而是同一功能（登出）在两个并行组件（`NavUser` 用于 dashboard 侧边栏、`UserMenu` 用于公共站点 header）中出现了功能不一致——一个真实可用，一个是模板遗留的死按钮。用户在已登录的 dashboard 内点击侧边栏"Log out"完全没有效果，是一个真实的功能缺口，同时也说明这两个「用户菜单」组件之间没有共享逻辑/复用关系，是重复造轮子的早期信号（违反 AGENTS.md 的"Module boundaries: keep modules independent, with clear responsibility boundaries"及避免不必要重复的精神）。
- **严重程度**：应尽快重构（should refactor soon）——功能性缺口，用户可感知，且和"清理模板残留"是同一个任务的一部分。

---

## 发现 3：`(public)` 首页仍是 Better-T-Stack 脚手架的占位内容，与 ADR-0018 的落地状态不一致

- **位置**：`apps/web/src/app/(public)/page.tsx`
    - 整个文件是 `"use client"` 组件，渲染 ASCII 艺术字 "BETTER T STACK"（脚手架工具 create-better-t-stack 的品牌横幅，参见 `README.md:3`），以及一个空的 "API Status" 占位区块，没有任何真实内容。
- **同时缺失 ADR-0018 要求的语言前缀路由**：仓库中未发现 `next-intl`、`useTranslations`、`hreflang`、`middleware.ts` 或任何 `[locale]` 目录（已用 grep/find 全仓库确认）。`apps/web/package.json` 也未依赖 `next-intl`。也就是说 ADR-0018 决定的"`/en/...`、`/zh/...` 独立可索引 URL + hreflang"路由方案尚未在代码中落地，`(public)` 路由组现在只是单一无语言前缀的路由。
- **为什么是问题**：ADR-0018 明确了"page inventory 和视觉/3D 处理不在本 ADR 范围内，后续设计再定"，所以内容缺失本身可以理解为"尚未开始"，不算违反 ADR。但需要指出：`(public)` 目录已经存在并且已经挂了一个页面文件，如果后续继续在不带 locale 前缀的路径下添加更多公共页面，等真正引入 `next-intl` 时会需要把整个 `(public)` 路由组迁移到 `[locale]` 动态段下（否则无法满足 ADR-0018 的"每种语言独立可索引 URL"要求），造成返工。这是一个"当前实现还没有跟上已拍板的 ADR 决策"的落差，值得在启动公共站点内容迭代前先处理路由结构，而不是先堆内容再迁移。
- **严重程度**：阻塞即将开始的工作（blocks upcoming work）——如果"发起 issue #30 讨论"的后续工作包含开始填充公共网站内容（AGENTS.md 中提到的"XDenovo 是 AI4Bio 定位"的官网内容),应该先把 locale 路由骨架搭好，否则会在内容页面刚开始堆叠时就产生结构性返工。

---

## 发现 4：ADR-0012 的 RSC-直连-gateway vs. Route-Handler-BFF 边界，目前没有出现"漂移"，但也几乎没有被真正践行过

- **观察**：
    - 唯一一处调用 gateway 的代码是 `apps/web/src/app/api/gateway/auth/route.ts`，它是一个 Route Handler，正确地把 `@taskome/api-client` 的 `getCurrentIdentity()` 调用包起来，并把 `GatewayAuthenticationError`/`GatewayResponseError` 映射成浏览器可读的 401/502 响应（`route.ts:7-26`）——这完全符合 ADR-0012 "Route Handlers are the browser-facing BFF boundary" 的定义，写法干净。
    - 全仓库搜索确认：没有任何 `"use client"` 组件导入 `@taskome/api-client` 或 `generated/gateway`（已用 grep 验证），没有违反"server-only、永不进入 client 组件"的边界。
    - 但同时，`(app)/dashboard` 之类的 Server Component 页面目前完全没有调用 gateway（数据来自本地 `data.json`），所以 ADR-0012 描述的"RSC/Server Action 直接调用 server-only 生成客户端读取 gateway 数据"这条路径在当前代码里**一次都没有被实际使用过**——只验证了 Route Handler 这一侧。
- **为什么值得记录**：这不是一个"违反"，而是一个"未验证"的架构假设。等第一个真正的 Job/Task 列表页面接入 gateway 时，才会第一次真正检验 RSC 直连模式是否好用（错误处理、loading 状态、鉴权失败重定向等）。建议在设计下一个功能时把这当作第一个真实验证点，而不是想当然地认为模式已经跑通。
- **严重程度**：只值得记一笔（minor，worth a note only）——现状本身没有问题，是留给后续工作的一个"未知数"提醒。

---

## 发现 5：`@taskome/api-client` 的核心行为测试被错放在 `apps/web` 里，而不是包自身

- **位置**：`apps/web/src/lib/api-client.test.ts` 整个文件测试的是 `packages/api-client/src/mutator.ts`（`gatewayFetch`：JWT 附加、`no-store` cache、鉴权失败抛错）的行为，通过 `await import("@taskome/api-client")` 从外部导入被测代码；而 `packages/api-client` 包本身（已用 find 确认）**没有任何 `*.test.ts` 文件**。
- **为什么是问题**：`apps/web/src/lib/` 目录里并不存在与该测试同名的 `api-client.ts` 模块——这个文件名容易让人误以为 apps/web 自己维护了一层 api-client 封装（实际上没有，ADR-0012 的设计就是 apps/web 直接使用 `packages/api-client` 生成的客户端）。测试应当随被测代码本体所在的包走：`packages/api-client` 才是 `gatewayFetch`/JWT 附加逻辑的责任方，测试放在消费方（apps/web）里，一旦 `packages/api-client` 被其他服务/包复用，测试覆盖会被遗留在错误的位置，且容易被忽略维护。这是模块边界（AGENTS.md "Module boundaries: keep modules independent, with clear responsibility boundaries"）层面的轻微违反。
- **严重程度**：应尽快重构（should refactor soon）——改动成本很低（把测试文件搬到 `packages/api-client/src/mutator.test.ts` 并调整 mock 路径），但目前状态会误导下一个接触这块代码的人。

---

## 发现 6：两个独立的、职责重叠的 header/用户菜单实现

- **位置**：
    - `apps/web/src/components/header.tsx` + `apps/web/src/components/user-menu.tsx`（用于 `(public)` 路由组）
    - `apps/web/src/components/site-header.tsx` + `apps/web/src/components/nav-user.tsx`（用于 `(app)` 路由组）
- **观察**：两者除了视觉风格（顶部 header vs. sidebar footer 下拉）不同外，都在做"展示当前用户 + 提供登出入口"这件事，但实现完全独立、没有共享的 hook 或子组件，并且行为不一致（见发现 2：一个可登出，一个不可登出）。`site-header.tsx:10` 的标题目前硬编码为 `"Documents"`，与页面实际内容（dashboard 数据表格）无关，这也是模板残留的又一处。
- **为什么是问题**：`(app)` 和 `(public)` 是两个完全不同的产品面（内部工具平台 vs. 官网），header 风格不同是合理的（不应该强行合并成一个组件）；但"当前用户身份 + 登出"这个逻辑本可以抽成一个共享的 hook（例如 `useCurrentUser`/`useSignOut`），而不是各自重复实现一遍 `authClient.useSession()` + 下拉菜单渲染。目前的重复不算严重，但如果后续在两个路由组里都继续独立演化用户菜单功能（比如加通知、加设置入口），重复会进一步扩大。
- **严重程度**：只值得记一笔（minor，worth a note only）——规模尚小（两个组件），暂时不构成结构性负担,但值得在下一次触碰任一组件时顺手合并成共享逻辑。

---

## 发现 7：与 `(auth)` 语义相关的三个路由游离在三大路由组之外，且鉴权/重定向逻辑分散

- **位置**：`apps/web/src/app/two-factor/page.tsx`、`apps/web/src/app/security/two-factor/page.tsx`、`apps/web/src/app/oauth/consent/page.tsx` 都直接挂在 `app/` 顶层，不属于 `(app)`、`(auth)`、`(public)` 任何一个路由组。
- **分析**：这大概率是有意为之——`(auth)/layout.tsx:10-13` 会把"已登录用户"重定向到 `/dashboard`，而 2FA 挑战页、OAuth consent 页恰恰需要在"已建立会话但流程未完成"的中间状态下可访问，放进 `(auth)` 分组会被误重定向；放进 `(app)` 分组又会被要求完整会话。所以脱离分组是合理的技术选择，而不是明显的错误。
- **为什么仍然值得记录**：ADR-0018 描述的路由结构只提到三个分组，没有说明"游离于分组之外的鉴权中间态页面"这一类别如何归类；三个页面各自独立处理鉴权/重定向（例如 `two-factor/page.tsx` 没有服务端会话校验，完全依赖客户端 `authClient` 状态），没有一处集中说明"这些页面为什么在分组之外"。这不是 bug，但对后续维护者不友好——容易被误判为"漏分组"而被强行塞进某个 route group，从而引入前面提到的重定向死循环风险。
- **严重程度**：只值得记一笔（minor，worth a note only）——建议后续要么在代码注释/ADR 里补一句说明这类页面的分组原则，要么考虑一个专门的路由组（如 `(auth-flow)`）承载它们，但当前不阻塞任何工作。

---

## 未发现问题的领域（明确说明，而非省略）

- **`packages/api-client` 的消费方式**：`apps/web` 中唯一的消费点（`app/api/gateway/auth/route.ts`）完全遵守"server-only、JWT 由 mutator 自动附加、调用方不接触 token"的约定；未发现任何客户端组件尝试导入该包；`GATEWAY_INTERNAL_URL` 也正确地只存在于 `@taskome/env/server`（未在 `@taskome/env/web` 中出现）。这部分是完全合规的。
- **`src/lib/logger.ts`、`request-context.ts`**：都以 `import "server-only"` 开头，`logger.ts` 对 `authorization`/`cookie`/`password`/`token`/`secret`/`session` 等敏感字段做了 redact,`request-context.ts` 用 `AsyncLocalStorage` 串联 `request_id`，且已在 `app/api/auth/[...all]/route.ts` 中正确使用（记录请求耗时、状态码、request_id header）。没有发现设计上的问题。
- **`auth-client.ts`**：单一职责，只做 `createAuthClient` 的插件装配（`jwtClient`、`oauthProviderClient`、`twoFactorClient`),没有越界逻辑，符合预期。
- **登录/注册表单（`login-form.tsx`、`signup-form.tsx`）**：两者结构高度一致（`@tanstack/react-form` + `zod` schema + `authClient`),是目前 `components/` 里质量最高、最贴合真实产品需求的部分，没有发现架构层面的问题（重复的 TODO 注释见下方"次要备注",不影响架构判断)。
- **组件目录整体扁平化程度**：`components/` 目前 16 个文件，尚未出现"随着应用增长而变得难以查找"的规模问题；按 AGENTS.md"今日的需求：避免为假设中的未来需求引入抽象/配置/间接层"的原则，现在引入 `components/dashboard/`、`components/auth/` 等子目录分组还为时过早——这一点判断为**没有问题**，而不是遗漏,但一旦 dashboard 真实功能开始落地（发现 1 的清理动作),应同步考虑按路由组或功能域拆分子目录。

---

## 次要备注（不构成独立发现，仅记录）

- `apps/web/src/app/(auth)/layout.tsx:11`、`apps/web/src/components/signup-form.tsx:54`、`apps/web/src/components/login-form.tsx:51` 三处出现完全相同的注释 `// TODO: honor a callbackUrl query param instead of always redirecting to /dashboard`。三处重复暗示这个"登录后跳转目标"逻辑将来最好被收敛成一个共享的工具函数，而不是三份独立的硬编码 `/dashboard` 跳转 + 相同的 TODO。当前不影响架构评审结论，留待相关功能被实际触碰时一并处理。
