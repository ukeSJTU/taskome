# packages/* 架构一致性审查

对应 issue #31（既有代码架构一致性审查：packages/\*）。审查范围：`packages/auth`、`packages/db`、`packages/env`、`packages/ui`、`packages/api-client`（`packages/config` 仅是共享 tsconfig 基座，略过）。

审查方法：通读每个包的 `src/` 全量文件，对照 `docs/adr/0003-gateway-jwt-auth.md`、`docs/adr/0012-web-bff-gateway-data-ownership.md`、`docs/adr/0016-task-kit-shared-library.md` 以及 `AGENTS.md` 的工程原则（模块边界清晰、不为假设性未来需求做抽象）逐项核对。本审查只关注**架构一致性与设计坏味道**，不做逐行代码质量审查；不提出重新设计方案，只指出问题点。

---

## 1. packages/auth

**结论：与 ADR-0003 / ADR-0012 描述的角色基本一致，但发现一处配置漂移风险。**

- `src/index.ts:15-42` 中 `betterAuth()` 配置包含 `jwt()` 插件、`oauthProvider()`（`validAudiences: [env.GATEWAY_INTERNAL_URL]`, `disableJwtPlugin: false`）、自定义 `oauthGatewayAudience` 插件、`twoFactor()`、`nextCookies()`。这与 ADR-0003"网关用单一 JWKS 校验器验证 web 会话 JWT 与 MCP 的 OAuth JWT"以及 ADR-0012 consequences 中"`betterAuth()` 配置需要接入 `jwt` 插件"的要求相符，未发现偏离。
- `src/oauth-audience.ts:1-30` 的职责说明（Better Auth 1.6.x 仅在请求携带 `resource` 参数时才签发 JWT 格式的 OAuth access token）与 ADR-0003 描述的"共享 auth 配置内部提供固定 gateway audience，外部 MCP 客户端无需自行实现 RFC 8707"完全对应，属于按 ADR 精确落地的实现，无 smell。

### 发现 1：`src/test.ts` 与 `src/index.ts` 的 better-auth 配置手工重复维护，存在漂移风险

- 位置：`packages/auth/src/test.ts:9-41` vs `packages/auth/src/index.ts:15-42`
- 现象：`test.ts` 独立重新声明了一份 `oauthProvider({ scopes: [...], validAudiences: [...], disableJwtPlugin: false, ... })`、`jwt()`、`oauthGatewayAudience(...)`、`twoFactor({ issuer: "taskome" })` 等配置，与生产配置逐字段手写重复（仅 `database` adapter 换成 `memoryAdapter`，额外加了 `testUtils`）。两处配置没有共享的"核心配置"函数，只是 `oauthGatewayAudience` 复用了同一个导出。
- 为何是坏味道：违反 AGENTS.md "Module boundaries: keep modules independent, with clear responsibility boundaries" 的隐含要求——测试配置本应是生产配置的最小变体，而不是并行副本。如果未来修改 `index.ts` 里的 scopes/audience/插件顺序（例如 ADR 演进导致的安全配置变更），`test.ts` 不会自动同步，测试会在"看起来通过"的情况下验证一份过期的 auth 配置，掩盖真实的回归。
- 严重程度：应尽快重构（should refactor soon）——不阻塞当前工作，但随着 auth 配置演进（尤其涉及安全相关的 scopes/audience），漂移的测试配置会逐渐降低测试的信噪比。

---

## 2. packages/db

**结论：严格符合 ADR-0012 的所有权边界，未发现 scope creep。**

- `src/schema/auth.ts:4-303` 中定义的表全部是 better-auth 相关表：`user`、`session`、`account`、`verification`、`jwks`、`oauthClient`、`oauthRefreshToken`、`oauthAccessToken`、`oauthConsent`、`twoFactor`，以及对应的 `relations()`。没有出现 job/input-file 等应属于 gateway 所有权的业务表。
- `src/migrations/0000_shallow_franklin_richards.sql` 中 `CREATE TABLE` 语句（第 1/17/25/39/73/83/98/110/120/132 行）与 schema 定义完全一致，同样只有 auth 相关表。
- `drizzle.config.ts:12` 设置 `schemaFilter: ["public"]`，与 ADR-0012"Postgres 按 owner 拆分 schema，`packages/db`（Drizzle）继续只拥有 auth schema"的描述吻合——drizzle-kit introspect/generate 被显式限制在 `public` schema，不会误触未来 gateway 新增的 `gateway` schema。
- `src/index.ts:1-10` 仅创建一个 `drizzle()` 实例并导出 `createDb`/`db`，职责单一，无跨边界查询逻辑。

本包未发现需要标注的架构问题。

### 附带观察（非独立 finding，仅记录）

- `drizzle.config.ts:4-6` 用 `dotenv.config({ path: "../../apps/web/.env" })` 硬编码相对路径指向 `apps/web/.env`，使得本应"服务无关"的 `packages/db` CLI 工具配置隐式假设自己总是被 `apps/web` 这一个消费方以固定相对路径关系放置在 monorepo 中。这是 dev-only 工具脚本，非运行时代码，暂不构成独立 finding，但如果未来有第二个消费方（例如另一个需要连接同一 auth schema 的服务）会需要重新设计这个路径假设。

---

## 3. packages/env

**结论：server/client 分离的结构是对的，但"server-only"边界只靠文件命名约定，没有硬性强制，与仓库里其他同类边界的做法不一致。**

- `src/server.ts:5-18` 用 `@t3-oss/env-core` 的 `createEnv` 校验 `DATABASE_URL`、`BETTER_AUTH_SECRET`（`min(32)`）、`BETTER_AUTH_URL`、`GATEWAY_INTERNAL_URL`、`AUTH_TRUSTED_ORIGIN` 等纯服务端密钥/配置，`emptyStringAsUndefined: true` 且未跳过校验（除非显式 `SKIP_ENV_VALIDATION`），这部分设计合理。
- `src/web.ts:3-8` 用 `@t3-oss/env-nextjs` 声明了一个 `client: {}` / `runtimeEnv: {}` 的空壳。

### 发现 2：`packages/env/src/server.ts` 未导入 `server-only`，与仓库里已确立的"server-only 文件必须显式 import server-only"约定不一致

- 位置：`packages/env/src/server.ts`（整个文件，对照第 1 行本应有 `import "server-only";`）
- 对照：仓库中已有的同类边界都显式加了这行——`packages/api-client/src/mutator.ts:1`、`apps/web/src/lib/logger.ts:1`、`apps/web/src/lib/request-context.ts:1`。ADR-0012 第 11 行明确写"the package imports Next.js's `server-only` to fail loudly if it's ever pulled into a client component"，这是本仓库对"服务端专属代码"的既定处理模式。
- 为何是坏味道：`packages/env/src/server.ts` 恰恰是全仓库最敏感的一处——它承载 `DATABASE_URL`、`BETTER_AUTH_SECRET` 等真正的密钥读取——却只靠文件名 `server.ts`（约定）而非 `server-only` 包（强制、构建期报错）来防止被误打包进客户端组件。当前之所以没有暴露问题，是因为 `createEnv` 的 `min()`/`url()` 校验在缺少这些 env 值时会在运行时抛错，间接起到了兜底作用，但这依赖"校验刚好失败"这个副作用，而不是"导入即刻明确失败"的显式保护,且如果有人给某个字段加了 `.optional()` 或 `skipValidation` 被误开，这层兜底会消失且不会有任何提示。
- 严重程度：应尽快重构（should refactor soon）——不是当前阻塞项，但该包正是密钥的源头，应该采用与 `api-client`/`logger`/`request-context` 相同的强约束，而不是比它们更弱。

### 发现 3（记录，非严重）：`src/web.ts` 是完全未被消费的空壳

- 位置：`packages/env/src/web.ts:1-8`；确认：`apps/web` 代码库中没有任何文件 `import` `@taskome/env/web`（已用 grep 核实，含 `.next` 构建产物在内均无匹配）。
- 为何值得记录：AGENTS.md "Today's requirements: Implement the least complex solution that satisfies today's requirements. Avoid abstractions ... intended for hypothetical future needs" 明确反对预先搭建当前用不到的抽象。`web.ts` 目前是一个空的 `client: {}` 占位符，没有任何客户端环境变量需要校验。
- 严重程度：轻微（minor）——这是常见的脚手架模式（T3 stack 风格），一旦有公开站点需要 `NEXT_PUBLIC_*` 变量会立刻用上，暂不必现在处理，仅记录。

---

## 4. packages/ui

**结论：包边界干净——`src/` 内没有任何文件 import 其他 `@taskome/*` 包（已用 grep 核实），是真正独立可消费的组件库，符合"清晰职责边界"。测试基建缺失已知（ticket F2 覆盖），此处不重复列为新 finding。**

### 发现 4：存在多个已注册导出、但在 `apps/web` 中零消费的"聊天 UI"专用组件，与当前产品方向不符

- 位置：`packages/ui/src/components/bubble.tsx`（123 行）、`packages/ui/src/components/message.tsx`（84 行）、`packages/ui/src/components/message-scroller.tsx`（129 行）、`packages/ui/src/components/attachment.tsx`（198 行）
- 核实方式：对 `apps/web/src` 做 `@taskome/ui/components/*` import 全量扫描，实际被消费的组件集合为 `avatar/badge/button/card/chart/checkbox/drawer/dropdown-menu/field/input/input-group/label/select/separator/sidebar/skeleton/sonner/table/tabs/toggle-group`；`attachment`、`bubble`、`message`、`message-scroller` 均不在其中，且这四个文件在语义上明显是"聊天气泡/消息流/附件"这类 AI 对话界面组件，而不是通用 shadcn 基础组件（对比同样未被消费但属通用组件库常规储备的 `breadcrumb`/`empty`/`marker`/`sheet`/`textarea`/`toggle`/`tooltip`）。
- 为何是坏味道：AGENTS.md "Project direction" 中当前定义的产品形态是"面向 Job 的工具平台"（PepMimic/BindCraft/GraphPep 等计算工具 + REST/MCP），未提及任何对话式/聊天式界面；AGENTS.md 工程原则也明确"避免为假设性未来需求做抽象"。这四个组件体量不小（合计 534 行）且是成组的一整套对话 UI 原语,如果不是即将启动的具体功能所需，属于超前构建。
- 严重程度：轻微（minor）——不影响现有功能正确性，但值得在下一次清点 `packages/ui` 内容时确认这批组件是否对应某个已排期的功能；如果没有,应作为"清理过时/未使用代码路径"（AGENTS.md "Cleanup" 原则）的候选项。

### 发现 5（记录，非严重）：`react`/`react-dom` 在 `package.json` 中是 `dependencies` 而非 `peerDependencies`

- 位置：`packages/ui/package.json:16-30`（`"react": "catalog:"`, `"react-dom": "catalog:"` 位于 `dependencies` 块）
- 为何值得记录：作为一个"可独立消费的组件库"，通常约定 react/react-dom 应声明为 `peerDependencies`（由宿主 app 提供单一版本），避免多副本 React 导致的 hooks 错误；当前放在 `dependencies` 里让 pnpm 有可能为该包单独解析一份版本。因为仓库统一走 pnpm catalog（`pnpm-workspace.yaml` 固定 `react: ^19.2.8`），实际发生版本分裂的风险很低。
- 严重程度：轻微（minor）——目前无实际影响，仅为包发布/独立使用场景下的规范性问题记录。

---

## 5. packages/api-client

**结论：`mutator.ts` 的 JWT 挂载逻辑与 `server-only` 强制均正确落实 ADR-0012 的要求;但该包对 `@taskome/auth`（进而对 `@taskome/db`）的依赖使其比"生成的 API 客户端"这个定位要重得多，值得关注。**

- `src/mutator.ts:1` 开头即 `import "server-only";`，与 ADR-0012 第 11 行"the package imports Next.js's `server-only` to fail loudly if it's ever pulled into a client component"完全一致。
- `src/mutator.ts:24-43` 的 `gatewayFetch` 在每次请求时通过 `auth.api.getToken({ headers: await headers() })` 取当前会话的 JWT，设置 `Authorization: Bearer <token>` 头，符合 ADR-0012"Every call carries a short-lived JWT that better-auth's `jwt` plugin mints for the current session ... A custom orval mutator inside that package attaches the JWT to every request, so call sites never handle tokens directly"的描述。未发现调用方（`src/generated/gateway.ts:5,45-50`）绕过 mutator 直接处理 token 的情况。
- `orval.config.ts:11-15` 将 mutator 显式接到 orval 生成配置，生成产物 `src/generated/gateway.ts` 未手工编辑（文件头注释"Do not edit manually"），符合 ADR-0012"client 由 orval 从检入的 `openapi.json` 生成"的要求。

### 发现 6：`packages/api-client` 直接依赖 `@taskome/auth`（进而传递依赖 `@taskome/db`/Postgres/Drizzle），使一个理应"薄"的生成客户端包携带了完整的 auth 服务端技术栈

- 位置：`packages/api-client/src/mutator.ts:3`（`import { auth } from "@taskome/auth"`）、`packages/api-client/package.json:16`（`"@taskome/auth": "workspace:*"`）
- 依赖链：`api-client → auth → db → env`（已通过逐包 `package.json` 核实，未发现反向依赖，无循环）。
- 为何值得关注：ADR-0012 本身要求"mutator 挂载 JWT"，所以这个依赖方向是 ADR 明确设计出来的,不是实现者自行引入的偏差——因此不定性为"违反 ADR"的 finding,而是记录一个耦合代价：任何导入 `@taskome/api-client`（哪怕只是想用其中的类型或 `GatewayResponseError`）的模块，都会传递性地拉入 better-auth 的服务端配置、Drizzle、`pg` 连接池等重量级依赖,而不是一个只含 fetch 逻辑和类型的轻量客户端。这与"generated client"这个名字给人的直觉（薄、无副作用）不符,后续如果 api-client 的消费面扩大（例如被 gateway 之外的其他 server-only 场景引用),这个隐式的"整个 auth 栈"依赖会被放大。
- 严重程度：轻微（minor）——当前唯一消费方就是需要这个 token 的 Server Component/Action,依赖是必要的、且被 `server-only` 正确兜底,不会泄漏到客户端;仅作为架构注记,供后续如果拆分"取 token"与"发请求"两个职责时参考。

---

## 6. 跨包依赖方向 / 循环依赖检查

对五个包（含 `config`）的 `package.json` 做了完整的 `@taskome/*` 依赖扫描：

```
config   : (无内部依赖，叶子)
env      → config
db       → env, config
auth     → db, env, config
ui       → config（仅 devDependency，用于 tsconfig；运行时无任何 @taskome/* 依赖）
api-client → auth, env, config
```

- 未发现任何循环依赖。
- 依赖方向单调递增（`env` 是基座 → `db` 依赖 `env` → `auth` 依赖 `db`+`env` → `api-client` 依赖 `auth`+`env`），与 ADR-0012 描述的"env 提供配置 → db 提供 auth 表访问 → auth 组装 better-auth 实例 → api-client 用 auth 铸造的 token 调用 gateway"这条自然的构建顺序完全吻合。
- `ui` 包在依赖图中完全孤立（运行时零 `@taskome/*` 依赖），是唯一"纯组件库"角色的包，符合预期。

本部分未发现需要标注的架构问题。

---

## 附：本次审查未涉及但顺带确认的事项

- 未对 `packages/config` 做除包结构外的实质审查（按任务要求，仅是共享 tsconfig 基座，`package.json` 内容仅有 name/version/private 三个字段，无异常）。
- `packages/ui` 的测试基建缺失（zero test setup）已知,由 ticket F2 覆盖,此处不重复列出。
