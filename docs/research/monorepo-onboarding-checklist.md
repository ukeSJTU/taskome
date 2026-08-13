# Monorepo 新增 app/package 接入清单

来源：GitHub issue #28（"H: Monorepo 新增 app/package 的接入清单"）。

本文档是**纯粹的信息汇编**：只摘录、整理仓库现有配置文件与 ADR 中已经写明的规则，不新增设计、不臆测未决事项。每一条都标注了出处文件/ADR；凡是现有资料没有覆盖到的地方，会在文末的"未覆盖 / 待决问题"一节中明确列出，而不是替它给出答案。

两个即将落地的消费场景：

- **`packages/task-kit`**：新的 Python 库包，无独立部署（ADR-0016 已经把它当作范例讨论过）。
- **`apps/docs`**：新的 Next.js app，独立部署在自己的子域名上（ADR-0020 已经把它当作范例决定过）。

下面分两节整理，每节内部再按"要不要做"分组。

---

## 一、新增一个 Python 库/包（以 `packages/task-kit` 为例）

### 1. `pnpm-workspace.yaml` —— 不需要改

`pnpm-workspace.yaml` 用**显式列表**（不是 glob）登记 TS 成员：

```yaml
packages:
    - apps/web
    - packages/api-client
    - packages/ui
    - packages/auth
    - packages/db
    - packages/env
    - packages/config
```

`packages/task-kit` 是纯 Python 包、没有 `package.json`，因此**不需要**列进这里；不用列入就等于自动被排除，不需要额外的排除规则。
—— 出处：`pnpm-workspace.yaml`；ADR-0016 "Location and workspace membership" 段原话："`pnpm-workspace.yaml` enumerates member paths explicitly rather than globbing, so simply not listing it there is sufficient; no exclusion rule is needed."

### 2. 根 `pyproject.toml` 的 `[tool.uv.workspace].members` —— 需要加

当前只有 `apps/gateway` 一个成员：

```toml
[tool.uv.workspace]
members = ["apps/gateway"]
```

需要把 `packages/task-kit` 加进去，变成 `members = ["apps/gateway", "packages/task-kit"]`。
—— 出处：`pyproject.toml`；ADR-0016 明确说 task-kit "**It is added** to the root `pyproject.toml`'s `[tool.uv.workspace].members`, alongside `apps/gateway`" —— 因为它是我们自己的库代码、无独立部署，不需要像 Task Server 那样做依赖/锁文件隔离。

加入之后需要重新跑 `uv sync`（或对应的 lock 步骤）以更新 `uv.lock`，因为 CI（见下文第 6 条）用的是 `uv sync --locked`，锁文件必须先于 PR 反映新成员。（这一点是 `pyproject.toml` + `.github/workflows/ci.yml` 两处配置的自然推论，ADR 没有逐字写出，仅供留意。）

### 3. 根 `mise.toml` 的 `[monorepo].config_roots` —— 需要加

当前：

```toml
[monorepo]
config_roots = ["apps/gateway"]
```

需要加上 `"packages/task-kit"`。文件顶部有提醒注释："Remeber to run `mise lock` after changing this file to update the lockfile."，所以改完要跑 `mise lock`。
—— 出处：`mise.toml`；ADR-0016："registered in the root `mise.toml`'s `[monorepo].config_roots`, matching the existing `apps/gateway` pattern."

**`config_roots` 的实际作用**：让 mise 把该目录下的 `mise.toml` 识别为一个子项目任务根，从而可以用 `mise run //packages/task-kit:<task>` 这种命名空间语法调用其任务（这正是 `apps/gateway` 现在被引用为 `//apps/gateway:lint` 等的方式，见第 4 条）。

### 4. `packages/task-kit/mise.toml`（新文件）—— 需要建

参照 `apps/gateway/mise.toml` 的模式，但只保留 `lint`/`format`/`check`/`test`，**不要** `dev`/`start`（也不需要 `db:*` 任务）。
—— 出处：ADR-0016："It has its own minimal `mise.toml` (`lint`/`format`/`check`/`test` only, no `dev`/`start`, since it's a library, not a service)"；`apps/gateway/mise.toml` 作为参照模式的具体写法（`[tasks.lint]`/`[tasks.format]`/`[tasks.check]`/`[tasks.test]` 各自 `run = "uv run ruff ..."` / `"uv run ty check"` / `"uv run pytest"`）。

### 5. 根 `mise.toml` 顶层聚合任务的 `depends` 列表 —— 需要手动加一行（重要，容易漏）

根 `mise.toml` 里 `lint`/`format`/`check`/`test` 四个聚合任务目前是**显式**依赖 `apps/gateway`，不是自动发现：

```toml
[tasks.lint]
depends = ["ts:lint", "//apps/gateway:lint"]

[tasks.format]
depends = ["ts:format", "//apps/gateway:format"]

[tasks.check]
depends = ["ts:check", "//apps/gateway:check"]

[tasks.test]
depends = ["ts:test", "//apps/gateway:test"]
```

`config_roots` 只是让 `//packages/task-kit:lint` 这种任务**可以被调用**，但**不会自动**被拉进 `mise run check`（CI 实际执行的入口，见第 6 条）。要让 CI 真正跑到 task-kit 的 lint/format/check/test，必须手动把 `//packages/task-kit:lint` 等追加进这四个 `depends` 列表。
—— 出处：`mise.toml` 本身（`depends` 是硬编码列表，没有 glob）。ADR-0016 只说明了 task-kit 加入 `config_roots`，没有明确提到根聚合任务的 `depends` 需要同步更新——这是从 `mise.toml` 现有写法直接推出的一步，**不是**某条 ADR 里逐字写的，故单独标注来源为配置文件本身而非 ADR。

### 6. CI（`.github/workflows/ci.yml`）—— 不需要新增 job，但依赖前面几步做对

CI 目前三个 job（`check`/`test`/`build`）都是：`mise-action` 装工具链 → `pnpm install --frozen-lockfile` + `uv sync --locked` → `mise run check` / `mise run test` / `pnpm run build`。没有针对某个 app/package 的专门 job，全部通过 `mise run check`/`mise run test` 的 `depends` 扇出（第 5 条）和 `uv sync --locked`（因为 task-kit 已进 `uv.workspace.members`，第 2 条）自动覆盖。
—— 出处：`.github/workflows/ci.yml`。**前提**：第 5 条的 `depends` 必须手动加上，否则 CI 会"绿"但实际没有跑 task-kit 的检查（`uv sync` 会装它,但没人调用它的 lint/test 任务）。

### 7. 根 `pyproject.toml` 的 `[tool.ruff]` / `[tool.ty]` —— 不需要改

```toml
[tool.ruff]
extend-exclude = ["references"]

[tool.ty.src]
exclude = ["references", ".agents"]
```

这两个是按**路径 glob**生效的，与 `[tool.uv.workspace].members` 完全独立。`packages/task-kit` 下的一般 Python 源码不在排除列表里，因此自动被 lint/typecheck 覆盖，无需为它加任何配置——除非它以后有 vendored 的第三方 Python 源码，那时才需要像 `references` 一样加进 `extend-exclude`/`exclude`。
—— 出处：`pyproject.toml`；ADR-0016 "Toolchain clarification" 段专门澄清了这一点："Lint/typecheck coverage never required workspace membership — it applies to any first-party Python source not explicitly excluded, regardless of which `pyproject.toml` governs its dependency resolution."

### 8. 部署相关（Docker / compose / Caddy / DNS）—— 全部不适用

`packages/task-kit` 没有独立部署，不需要：

- 自己的 Dockerfile；
- `compose.yml`/`compose.prod.yml` 里的 service 条目；
- Caddyfile 里的 path/host block；
- DNS 记录。

—— 出处：ADR-0016 明确它"no independent deployment"；ADR-0008/ADR-0013 描述的 compose 部署单元目前只有 `web`、`gateway`（以及未来的 Task Server / Ray），task-kit 不是其中之一。

### 9. `tsconfig.json` / `packages/config/tsconfig.base.json` —— 不适用

task-kit 是纯 Python，没有 `package.json`/`tsconfig.json`，与 TS 的 tsconfig 继承体系无关。
—— 出处：ADR-0016（无 `package.json`）。

---

## 二、新增一个独立部署的 app（以 `apps/docs` 为例）

`apps/docs` 目前尚未创建（仓库里只有 `apps/gateway`、`apps/web`），但 **ADR-0020 已经把它的接入方式基本定下来了**，属于"设计已完成，只是还没落地建目录"的状态。以下逐项列出。

### 1. `pnpm-workspace.yaml` —— 需要加

显式列表加一行 `- apps/docs`（与 `pnpm-workspace.yaml` 现有 `apps/web` 同级写法）。
—— 出处：`pnpm-workspace.yaml`（显式列表，同第一节第 1 条的机制）。

### 2. `apps/docs/package.json` —— 需要新建，脚本名对齐既有约定

`package.json`（根）的脚本用 `pnpm -r <script>` 扇出到所有 workspace 成员：

```json
"scripts": {
  "dev": "pnpm -r dev",
  "build": "pnpm -r build",
  "check-types": "pnpm -r check-types",
  "test": "pnpm -r test"
}
```

只要 `apps/docs/package.json` 声明了同名脚本（参照 `apps/web/package.json` 的 `dev`/`build`/`check-types`/`test`/`start`），一旦成为 workspace 成员（第 1 条），就会被这些根脚本自动扇出到，**不需要**在根 `package.json` 里手动加任何东西。
—— 出处：根 `package.json`（`"dev": "pnpm -r dev"` 等）；`apps/web/package.json` 作为脚本命名的参照样例。

### 3. `apps/docs/tsconfig.json` —— 需要新建，直接 extend base，不改 base 本身

根 `tsconfig.json` 的写法：

```json
{
    "extends": "@taskome/config/tsconfig.base.json",
    "compilerOptions": { "noEmit": true },
    "exclude": ["node_modules", "references"]
}
```

新 app 只需要有自己的 `tsconfig.json` extend `@taskome/config/tsconfig.base.json`，`packages/config/tsconfig.base.json` 本身**不需要改动**——它是共享基座，不是按 app 登记的列表。
—— 出处：`tsconfig.json`、`packages/config/tsconfig.base.json`。

### 4. 根 `pyproject.toml` 的 `[tool.uv.workspace]` / 根 `mise.toml` 的 `[monorepo].config_roots` —— 不适用

`apps/docs` 是 Next.js/TS，不是 Python 项目，不需要加入 `uv.workspace.members`，也不需要在 `[monorepo].config_roots` 里登记。佐证：现有的 `apps/web` 同样是 TS app，`config_roots` 目前只有 `["apps/gateway"]`，`apps/web` 从未被列入过——说明 `config_roots` 这套机制是 mise 用来发现 **Python** 子项目（自身有 `mise.toml`）的，TS app 走的是 `pnpm-workspace.yaml` + 根 `package.json` 的 `pnpm -r` 扇出（第 1、2 条），两套机制并行、互不覆盖。
—— 出处：`mise.toml`（`config_roots = ["apps/gateway"]`，不含 `apps/web`）；`apps/web` 目录下无 `mise.toml`（对比 `apps/gateway/mise.toml` 存在）。

### 5. 根 `mise.toml` 的 `lint`/`format`/`check`/`test` 聚合任务 —— 不需要改

这四个任务对 TS 侧的依赖是 `"ts:lint"`/`"ts:format"`/`"ts:check"`/`"ts:test"`，分别 `run = "pnpm run lint"` 等，而根 `package.json` 里：

```json
"lint": "oxlint --fix",
"format": "oxfmt --write",
"check": "oxlint && oxfmt --check && pnpm check-types"
```

`oxlint`/`oxfmt` 是对整个仓库扫描的（不按 workspace 成员逐个列举），`check-types` 走的是 `pnpm -r check-types` 扇出（第 2 条已覆盖）。所以新增一个 TS app 会被**自动**纳入，不需要像第一节第 5 条那样手动改 `depends` 列表——这是 TS 侧与 Python 侧（`config_roots` + 显式 `depends`）的一个关键不对称，值得注意。
—— 出处：`mise.toml`（`ts:lint`/`ts:format`/`ts:check`/`ts:test` 任务定义）、根 `package.json`（`lint`/`format`/`check` 脚本实现）。

### 6. CI（`.github/workflows/ci.yml`）—— 不需要新 job，但 `build` job 需要新 app 有可用的 `build` 脚本和必要 env

`build` job 跑的是 `pnpm run build`（即 `pnpm -r build`），一旦 `apps/docs` 成为 workspace 成员且有 `build` 脚本（第 1、2 条），会自动被跑到。当前 `build` job 注入的 env（`DATABASE_URL`/`BETTER_AUTH_SECRET`/`BETTER_AUTH_URL`/`AUTH_TRUSTED_ORIGIN`）是为 `apps/web` 构建准备的；ADR-0020 说 `apps/docs` 是"static content ... no gateway access"，大概率不需要这些 env 才能 build，但**具体 build 是否需要新增环境变量，现有资料未覆盖**，需要在实际接入时验证（不是本清单能替它下结论的地方）。
—— 出处：`.github/workflows/ci.yml`（`build` job）；ADR-0020（"static content with no gateway access"）。

### 7. `apps/docs/Dockerfile`（新文件）—— 需要新建，照抄 `apps/web/Dockerfile` 的多阶段模式

`apps/web/Dockerfile` 的结构：`deps`（装 pnpm workspace 依赖）→ `builder`（`pnpm run build`，Next standalone 输出）→ `runner`（拷贝 `.next/standalone`/`.next/static`/`public`，非 root 用户，`EXPOSE`+`CMD`）。`apps/docs` 作为另一个 Next.js app，应遵循同一模式（build context 仍是仓库根，`COPY --parents` 带上 `apps/docs/package.json`）。
—— 出处：`apps/web/Dockerfile`（作为唯一现成的 Next.js 部署模式参照）；ADR-0013 "Consequences" 段提到 `apps/web/Dockerfile` 和 `apps/gateway/Dockerfile` 是这套 compose 拆分要引用的构建产物，新服务需要同样有一份 Dockerfile 才能被 compose 引用。

### 8. `compose.prod.yml` —— 需要新增一个 `docs` service 条目

参照现有 `web`/`gateway` 两个 service 的写法（`build.context: .` + `build.dockerfile: apps/docs/Dockerfile`、端口映射、`env_file`、`healthcheck`、`security_opt`/`cap_drop`/`read_only`/`restart` 等安全项）。
—— 出处：`compose.prod.yml`（`web`/`gateway` service 定义作为模式）；ADR-0013："`compose.prod.yml` is an overlay adding `web`, `gateway`, and — once they exist — GPU-bound Task Servers... started together via `docker compose -f compose.yml -f compose.prod.yml`" —— 新的公开部署服务同理加入这个 overlay 文件。

### 9. `compose.yml`（dev-support base）—— 大概率不需要改

ADR-0013 说明日常开发是原生跑 `web`/`gateway`（`pnpm dev`/`fastapi dev`），`compose.yml` 只放开发时需要的**支撑服务**（Postgres、SeaweedFS、otel-gui）。`apps/docs` 是静态内容站点，没有数据库等支撑服务依赖，所以本地开发大概率不需要在 `compose.yml` 里新增任何东西，直接 `pnpm dev`（第 2 条的扇出）即可跑起来。这是根据 ADR-0013 的原则推出的判断，不是逐字写明"apps/docs 不需要 compose.yml 改动"，供参考。
—— 出处：ADR-0013（dev-support base 的定义与原则）。

### 10. Caddyfile —— 需要新增一个 host block（但 Caddyfile 本身目前还不存在）

ADR-0019 定案用 Caddy 做生产反向代理，"Consequences" 段原话："Adding a third publicly-routed service later means adding a path/host block to the Caddyfile by hand — there's no auto-discovery"。ADR-0020 把 `apps/docs` 具体定为：走**独立子域名** `docs.taskome.com`（不是 ADR-0019 默认的单域名路径路由），作为对 ADR-0019 的"显式例外"，同样是"a new Caddyfile block"，Caddy 会自动为它签发证书（无需 wildcard/DNS-01）。

**但** `infra/proxy/README.md` 目前仍是占位说明："Placeholder — no target machine, domain, or certificate approach has been decided yet."，也就是说**真正的 Caddyfile 文件还不存在**——`apps/docs` 落地时，这会是第一次真正创建 `infra/proxy/Caddyfile`，同时把 `web`/`gateway` 的单域名路径路由块和 `docs.taskome.com` 的子域名块一起写进去。
—— 出处：ADR-0019（Caddyfile 路由约定、"third publicly-routed service" 段）；ADR-0020（`docs.taskome.com` 子域名决定、"deliberate exception to ADR-0019"）；`infra/proxy/README.md`（当前仍是占位文件的事实）。

### 11. DNS —— 需要新增 `docs.taskome.com` 记录

ADR-0020 "Consequences"："`docs.taskome.com` needs its own DNS record; Caddy still issues its cert automatically (no wildcard/DNS-01 setup needed)."
—— 出处：ADR-0020。

### 12. 鉴权/JWT 接入（ADR-0012 的 web→gateway 模式）—— 不适用

ADR-0020 明确 `apps/docs` 是公开、无鉴权的静态内容（"Content is public (no auth)"），不经过 gateway，不需要走 ADR-0012 描述的 `GATEWAY_INTERNAL_URL`/JWT/`packages/api-client` 那一套 BFF 鉴权链路——这正是它被允许作为 `apps/web` 之外第二个用户可见部署单元的前提（ADR-0020 第一段对 AGENTS.md "apps/web is the only user-facing deployable" 原则的例外说明）。
—— 出处：ADR-0020；ADR-0012。

---

## 三、未覆盖 / 待决问题（现有资料没有给出答案，不替它猜）

以下几点在阅读范围内的文件/ADR 中**没有找到明确答案**，如实列出，供后续单独决策，而非本清单杜撰：

1. **`infra/proxy/Caddyfile` 尚不存在**：`infra/proxy/README.md` 明确写着"目标机器、域名、证书方案都还没定"。ADR-0019/0020 定了*规则*（新服务=手写一个 block；`apps/docs` 用子域名），但没有一份可编辑的 Caddyfile 模板可参照，第一个接入的独立部署服务需要从零建这个文件。
2. **`apps/docs` 的 build 是否需要新的 env var / secrets**：CI `build` job 目前的 env 块是为 `apps/web` 准备的（`DATABASE_URL`/`BETTER_AUTH_SECRET`/`BETTER_AUTH_URL`/`AUTH_TRUSTED_ORIGIN`）。ADR-0020 说 `apps/docs` 无 gateway 访问、无鉴权，但没有逐条说明它的 build/runtime 是否完全零 env 依赖（如 analytics、`llms.txt` 生成相关配置等）。
3. **`packages/env`（`server.ts`/`web.ts`）是否需要为 `apps/docs` 新增一份 schema**：这个包目前按 app 拆了 `server.ts`/`web.ts` 两份 env 校验文件，但没有任何 ADR 提到新 app 接入时是否要照此模式加一份 `docs.ts`（或确认不需要）。这是"存在先例但没有写成规则"的情况，不代表一定要做，只是没人明确回答过。
4. **`packages/task-kit` 加入 `uv.workspace.members` 后 `uv.lock` 需要重新生成**、以及**加入 `mise.toml` 的 `config_roots` 后根聚合任务 `depends` 需要手动追加**——这两点是从现有配置文件的字面机制直接推出的操作步骤，ADR-0016 本身没有逐字写出"记得改 depends"/"记得重新 lock"，本文档在正文中已标注为"推论"而非 ADR 原文，仍建议后续把这类操作性细节沉淀进 ADR-0016 或一份新增 app/package 的 runbook，避免每次都靠读代码反推。
