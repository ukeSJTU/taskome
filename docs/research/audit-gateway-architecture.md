# apps/gateway 既有代码架构一致性审查

- 关联 Issue: #29「既有代码架构一致性审查：apps/gateway」
- 审查范围：`apps/gateway/src/gateway/**`（约 1632 行，`api/core/db/models/repositories/schemas/services` 全部模块）
- 审查基准：`docs/adr/0001`、`0003`、`0004`、`0005`、`0007`、`0009`、`0010`、`0011`、`0012`（另参考 `0002` 因被 `0011` 直接引用）
- 性质：仅关注**架构一致性与设计坏味道**，不做逐行代码质量审查（该部分由其他工具负责）。已明确：本次审查允许提出重构建议，不因为"现在能跑"而放弃指出问题。
- 严重度分级：
    - 🔴 **阻塞后续工作**——不先处理，Job/Task 子系统（ADR-0005）或 MCP Task Server 聚合（ADR-0007）落地时会直接踩坑或被迫推倒重来
    - 🟡 **应尽快重构**——现在能工作，但会持续放大维护成本或掩盖真实缺陷
    - ⚪ **轻微，仅记录**——观察到但不紧迫

---

## 发现 1：JWT 验证存在两套独立实现，算法硬编码不一致，`/mcp` 路径被重复鉴权

🔴 **阻塞后续工作**

**位置**

- `apps/gateway/src/gateway/core/auth.py:20-21`（`create_token_verifier`，基于 fastmcp 官方 `JWTVerifier`，**硬编码 `algorithm="RS256"`**）
- `apps/gateway/src/gateway/core/auth.py:49-135`（`JWKSVerifier` 类，手写的 JWKS 拉取/缓存/验签逻辑，**硬编码 `algorithms=["EdDSA"]`**，`_validate_header` 甚至强制要求 `alg == "EdDSA"`）
- `apps/gateway/src/gateway/core/middleware.py:120-144`（`MCPAuthenticationMiddleware`，对所有 `/mcp*` 请求用 `JWKSVerifier` 做一次鉴权）
- `apps/gateway/src/gateway/main.py:54-74`（`token_verifier` 传给 `create_mcp_server` 作为 fastmcp 的 `auth_provider`，即 `/mcp` 请求还会被 fastmcp 自身用 `JWTVerifier` 再鉴权一次；`gateway_auth_verifier`/`JWKSVerifier` 同时作为全局中间件挂载）
- `apps/gateway/src/gateway/core/auth.py:37-42`（REST 业务端点使用的 `current_user_id`，走的是 `current_access_token` → `token_verifier`，即 RS256 那一套）
- `apps/gateway/src/gateway/api/v1/endpoints/auth.py:10-14`（`GET /api/v1/auth/me` 走的是 `require_auth` → `JWKSVerifier`，即 EdDSA 那一套）

**问题**

ADR-0003 的标题就是"Gateway authenticates all callers with one JWT verifier"——"one code path regardless of caller type"。但当前代码里实际存在**两条完全独立的 JWT 验证实现**：

1. fastmcp 自带的 `JWTVerifier`（`core/auth.py:20`），被 `/v1/input-files/*`（REST 业务端点，经 `current_user_id`）以及生产环境下 `/mcp`（作为 fastmcp 的 `auth_provider`）使用，**硬编码 `algorithm="RS256"`**。
2. 手写的 `JWKSVerifier` 类（`core/auth.py:49-135`，含自己的 JWKS 拉取、5 分钟缓存、`jwt.decode` 调用），被 `MCPAuthenticationMiddleware`（包住所有 `/mcp*` 请求）和 `/api/v1/auth/me` 使用，**硬编码 `algorithms=["EdDSA"]`**。

这已经违反了「Existing capabilities first」原则——用 `pip show fastmcp` 确认过，`JWTVerifier.__init__` 本身就支持 `issuer: str | list[str]`、`audience: str | list[str]`、`algorithm: str | None`（`None` 时按 JWK 自动识别算法），也就是说 `JWKSVerifier` 重新实现的一切（issuer/audience 多值、JWKS 缓存、算法校验）官方库已经提供，没有理由手写第二套。

更严重的是**算法不一致像是真实的生产缺陷**：`packages/auth/src/index.ts:28` 中 `jwt()` 插件未做任何算法配置，better-auth 的 `jwt` 插件默认签发算法是 EdDSA（`tests/test_auth.py:25-43` 里为了模拟"真实"场景，特意用 `Ed25519PrivateKey` 签发测试 token，也印证了这一点）。而 REST 业务端点唯一依赖的 `token_verifier` 却硬编码只接受 RS256——**如果这个判断成立，`/v1/input-files` 的所有端点在生产环境下会对合法的 better-auth 令牌返回 401**。这一点没有被任何测试覆盖到：`test_input_file_api.py` 用 `StaticTokenVerifier` 直接替换掉了 `token_verifier`，从未真正跑过 RS256 校验路径。

另外，`/mcp` 路径实际被鉴权两次：先被 `MCPAuthenticationMiddleware`（EdDSA）挡一次，通过后请求进入 fastmcp 挂载的 ASGI 子应用，又会被 fastmcp 自己的 `auth_provider`（RS256）挡第二次——按上面的算法分析，第二次会失败，**`/mcp` 在生产环境可能整体不可用**。这个双重校验在测试里同样被"优化掉"了：`create_mcp_server` 在 `Environment.TEST` 下允许 `auth_provider=None`（`api/mcp.py:27-28`、`main.py:73`），所以现有测试从未同时触发"中间件 + fastmcp 内建鉴权"两层叠加的路径，掩盖了这个问题。

**为何值得标记为阻塞级**：ADR-0007 要求 MCP Task Server 通过 `mcp.mount()` 聚合到网关的同一个 `/mcp` 端点上；如果鉴权层本身是重复、不一致、且可能失效的，新团队在其上叠加更多 Task Server 只会把这个坑越挖越深。应当在引入更多 Task Server / Job 相关端点之前，把鉴权收敛成 ADR-0003 描述的"一套验证器"。

---

## 发现 2：Repository 的事务边界跨越了对外部服务（SeaweedFS）的网络调用

🟡 **应尽快重构**（会直接影响 Job 子系统的设计）

**位置**

- `apps/gateway/src/gateway/repositories/input_files.py:28-43`（`create()`，`@asynccontextmanager`，在 `async with self._database.transaction()` 内部 `yield`）
- `apps/gateway/src/gateway/repositories/input_files.py:61-84`（`mark_deleted()`，同样在事务内 `yield`，且查询带 `.with_for_update()` 行锁）
- `apps/gateway/src/gateway/services/input_files.py:46-56`（`mint_upload_url`：`async with self._repository.create(...) as input_file:` 代码块内部又调用了两次 `asyncio.to_thread(self._storage....)`，即两次对 SeaweedFS 的同步 boto3 网络调用）
- `apps/gateway/src/gateway/services/input_files.py:70-79`（`delete`：同样模式，`mark_deleted` 的行锁 + 事务在 `self._storage.delete(...)` 网络调用完成前都不会提交/释放）
- `apps/gateway/src/gateway/db/database.py:47-50`（`transaction()`：`async with self._sessions.begin() as session: yield session`，事务在 `async with` 块退出时才提交）

**问题**

`InputFileRepository.create`/`mark_deleted` 把 Postgres 事务的生命周期设计成一个 context manager，`yield` 出记录后再由调用方（service 层）决定何时退出。但 service 层恰恰利用这个特性，在事务**尚未提交**（`mark_deleted` 情形下甚至持有行锁）的窗口内，去调用 SeaweedFS 的 `ensure_bucket`/`mint_upload_url`/`delete`——这些是同步 boto3 HTTP 调用，通过 `asyncio.to_thread` 包了一层，但本质仍是网络 I/O，耗时不可控（对象存储抖动、超时等）。

这违反了 repositories/services 应有的职责边界：repository 应该只负责持久化，事务边界不应该被外部 I/O 撑大。当前设计下：

- Postgres 连接池只有 `pool_size=5`（`db/database.py:35`），每次上传/删除操作都会在整个 SeaweedFS 往返期间占用一个连接；
- `mark_deleted` 还带 `SELECT ... FOR UPDATE`，即删除操作在等待 SeaweedFS 响应期间持有一把行锁，并发删除同一 Input File 的请求会被阻塞在数据库锁而不是业务逻辑上；
- 这个模式一旦被复用到 Job 子系统会被放大：ADR-0005 明确要求"gateway always creates the Job first（DB 行）"然后再"enqueues via Taskiq"——如果沿用现在这种"repository yield 事务 + service 在内部做外部 I/O"的写法，Job 创建事务会跨越 Redis Stream 入队调用，一旦 Redis 抖动，数据库连接/事务会被无谓地拖长，风险比 SeaweedFS 场景更高（Job 表预期会有更高的写入频率）。

**建议关注点**（不展开具体重构方案，仅供后续设计参考）：repository 层的"创建/标记删除"应该在拿到主键或确认行存在后就提交并释放连接，外部 I/O 应该在事务外发生；如果需要"DB 写入失败则不做外部调用"的顺序保证，应该用返回值/显式两阶段调用来表达，而不是把外部调用塞进事务的 `async with` 块里。

---

## 发现 3：`models/` 包完全为空，与 `db/models.py` 同名但内容不同，语义混淆

🟡 **应尽快重构**（越往后添加实体，混淆成本越高）

**位置**

- `apps/gateway/src/gateway/models/__init__.py`（空文件，git blame 显示自 `6360c95`（FastAPI/MCP 基础设施提交）以来从未被修改或使用过）
- `apps/gateway/src/gateway/db/models.py:1-35`（真正的 SQLAlchemy ORM 定义 `InputFile` 就放在这里）
- 全仓库范围内没有任何 `import gateway.models` 或 `from gateway import models` 的引用（已用 grep 确认）

**问题**

题目给出的模块清单是 `api/core/db/models/repositories/schemas/services`，暗示 `models/` 应该是这套分层里独立的一环，但目前它只是一个从脚手架阶段遗留下来、从未填充过的空包，而实际的持久化模型放在 `db/models.py` 里（`db` 和 `models` 两个名字都在用，指向不同东西）。对一个刚接触代码库的新团队来说，这是一个明确的"目录结构在撒谎"信号：看到 `models/` 存在，会默认这里应该放某种领域模型/DTO，实际上要去 `db/` 找。

在当前只有一个实体（`InputFile`）时问题不明显，但 Job/Task 子系统上线后大概率会引入更多"层"（ORM 行 vs. repository 返回的记录 vs. service 返回的 DTO vs. API schema，参见下面发现 4），如果不先决定 `models/` 到底承担什么职责（还是干脆删除这个空包），新团队很可能会各自为政地往里面塞东西，造成进一步的层次混乱。

---

## 发现 4：单个实体已经有四种数据表示形式，值得在 Job 子系统落地前明确取舍原则

⚪ **轻微，仅记录**（当前规模下可以接受，但值得写清楚原则）

**位置**

- ORM 行：`apps/gateway/src/gateway/db/models.py:25-34`（`InputFile`）
- repository 返回的最小记录：`apps/gateway/src/gateway/repositories/input_files.py:19-22`（`InputFileRecord`，只有一个 `id` 字段）
- service 返回的 DTO：`apps/gateway/src/gateway/services/input_files.py:21-31`（`UploadUrl`、`DownloadUrl`）
- API 契约：`apps/gateway/src/gateway/schemas/input_files.py:7-21`（`CreateInputFileRequest`、`UploadUrlResponse`、`DownloadUrlResponse`）

**问题**

对同一个"Input File"概念，代码里维护了四套结构体：ORM 模型、repository DTO、service DTO、API schema。这是合理的分层实践（避免 ORM 泄漏到 API 层、避免 API 契约耦合数据库结构），不是坏味道本身。但由于 `InputFileRecord` 目前只有 `id` 一个字段，这套四层结构的"性价比"还看不太出来；等 Job 实体（状态机、时间戳、`trace_id`——ADR-0010 已经预留了这一列、重试次数等）落地后，这套模式会被复制、字段会明显变多，值得在设计 Job 子系统时明确一条准则：哪些字段该在哪一层出现、repository DTO 和 service DTO 什么时候可以合并。目前不是问题，但这是本次审查特意要点出的"提前预警"项。

---

## 发现 5：Repository 单元测试与 SeaweedFS 集成测试被捆绑在同一个 fixture 里，拖慢了本该轻量的持久化逻辑测试

🟡 **应尽快重构**

**位置**

- `apps/gateway/tests/test_input_file_service.py:30-87`（`input_file_service` fixture，`scope="module"`，同时起 `PostgresContainer` **和** 一个 `chrislusf/seaweedfs` `DockerContainer`）
- 同文件 `test_input_file_access_is_owner_scoped_and_ids_are_immutable`（第 170-180 行）本质上只是在验证 repository 层的所有权隔离 SQL 逻辑（`find_active_owned`/`mark_deleted` 里的 `owner_user_id` 过滤），却必须连带起一个 SeaweedFS 容器才能跑

**问题**

任务说明里明确提示"tests currently spin up real Postgres/SeaweedFS testcontainers for things that might not need them"，这里是一个具体例证：`InputFileService`/`InputFileRepository` 唯一的测试路径是通过这个"Postgres + SeaweedFS 双容器"fixture 间接跑通的（对照组：`test_input_file_api.py` 用 `FakeInputFileService` 完全绕开了真实 service/repository，只测 REST 层的委托关系；`repositories/` 目录下没有任何独立于 `services/` 的测试）。也就是说：

- 想验证"用户 A 看不到用户 B 的文件"这种纯粹的 SQL 过滤逻辑，必须连带启动一个对象存储容器，付出不必要的启动时间和维护成本（`HttpWaitStrategy(...).with_startup_timeout(90)`——单个 fixture 最长可能等 90 秒）；
- `InputFileRepository` 本身没有不依赖 `InputFileService`/SeaweedFS 的独立测试，一旦 Job 子系统引入更多 repository（预期会有），如果延续这个模式，"repository 逻辑 + 外部存储服务"耦合的测试成本会线性增加。

这与发现 2 是同一个根因的两个症状：service 层没有把"纯持久化逻辑"和"外部存储 I/O"在职责上拆开，测试自然也拆不开。建议在设计 Job 子系统的测试策略时，让 repository 层可以只用 Postgres（或者用现有 `AvailableDatabase` 类似的轻量 fake）单独测试，不必每次都拉起 SeaweedFS。

对照说明（同一关注点下的正面案例，供参考）：`apps/gateway/tests/conftest.py` + `tests/helpers.py:available_database`（`AvailableDatabase` 假对象）让大多数 API 层测试（`test_input_file_api.py`、`test_auth.py`、`test_mcp.py` 等）完全不需要真实 Postgres，这部分的可测试性设计是合理的，值得延续到 Job 子系统。

---

## 发现 6：`unhandled_error_handler` 手动重复添加安全响应头

⚪ **轻微，仅记录**

**位置**

- `apps/gateway/src/gateway/core/errors.py:126-145`（`unhandled_error_handler` 里手动调用 `security_headers(...)` 并 `response.headers.update(...)`）
- `apps/gateway/src/gateway/core/middleware.py:97-117`（`SecurityHeadersMiddleware` 已经对所有 HTTP 响应统一加了同样的头）

**问题**

异常处理器产生的响应仍会经过 `SecurityHeadersMiddleware`（它包裹在最外层，参见 `main.py:97-106` 的中间件注册顺序），所以 `unhandled_error_handler` 里这段手动加头的代码大概率是防御性的重复劳动。不算错误，但如果以后 `security_headers()` 的实现或调用方式发生变化，这里是一个容易被漏改、产生不一致的点。不紧急，建议顺手清理或者补一条注释说明为什么需要在两处都加。

---

## 发现 7：MCP 与 REST 的能力面尚不对等（仅记录，非坏味道）

⚪ **轻微，仅记录**

**位置**

- `apps/gateway/src/gateway/api/mcp.py:36-47`（MCP 只暴露了 `mint_input_file_upload_url` 一个工具）
- `apps/gateway/src/gateway/api/v1/endpoints/input_files.py:33-70`（REST 暴露了创建、下载 URL、删除三个端点）

**问题**

AGENTS.md 明确要求"MCP（面向 AI agent）与 REST（面向 web 应用）对每个 Task 都是必需的，二者缺一不可"。目前 Input File 的"下载"和"删除"能力只有 REST 版本，MCP 侧没有对应工具。审查范围内没有证据表明这是遗漏还是有意为之（增量交付、下载/删除暂时只服务于 web 端也是合理路线），因此本条不判定为坏味道，只作为一个需要在后续规划里明确澄清的点：如果外部 MCP Agent 确实需要下载/删除已上传的 Input File，这里目前是空白。

---

## 检查过、未发现问题的方面（明确列出，避免被误认为漏查）

- **`api/` 层是否夹带业务逻辑**：已逐个检查 `api/health.py`、`api/mcp.py`、`api/v1/endpoints/auth.py`、`api/v1/endpoints/input_files.py`。除发现 1 提到的鉴权路径分裂问题外，各 handler 本身都只做参数校验/依赖注入/委托调用，没有发现 SQL 查询或存储调用直接写在 API 层的情况。
- **`core/` 是否越权做了 DB 查询**：`core/auth.py`、`core/config.py`、`core/errors.py`、`core/lifespan.py`、`core/logging.py`、`core/middleware.py`、`core/observability.py` 均未发现直接的数据库访问；`lifespan.py` 里调用 `database.is_available()`/`is_at_head()` 是通过 `Database` 类的公开方法，边界清晰。
- **DB 查询是否外泄到 repositories/ 之外**：除发现 2 描述的"事务边界被撑大"问题外，`select(InputFile)...` 这类查询语句本身只出现在 `repositories/input_files.py` 里，没有在 `services/`、`api/` 里发现裸写的 SQLAlchemy 查询。
- **Alembic 迁移与 ORM 元数据是否一致**：`db/migrations.py`、`db/commands.py`、`db/alembic/versions/*` 结构清晰，`test_database_commands.py` 里有专门针对"push 只重建 gateway schema、不影响 public schema"和"migrate 幂等"的测试，未发现半成品或存根代码。
- **ADR-0004（对象存储走 S3 客户端而非直接进 Postgres）的落地情况**：`services/storage.py` 严格通过 boto3 S3 客户端与 SeaweedFS 交互，`db/models.py` 里的 `InputFile` 只存了 `id`（作为 storage key 的一部分）和元数据，符合 ADR-0004"业务逻辑只通过 S3 客户端跟存储打交道"的要求。
- **ADR-0011 的关键设计点（ownership-agnostic 存储 key、不可变 id、soft delete、`If-None-Match: *`）**：`services/input_files.py:_storage_key`（`uploads/{input_file_id}`，不含 owner/filename 分段）、`repositories/input_files.py` 的 `deleted_at` 软删除、`services/storage.py:46-52` 的 `IfNoneMatch: "*"` 均与 ADR-0011 描述一致，且 ADR 里显式标注为"TODO，暂不阻塞"的两处（文件大小上限、删除时校验非终态 Job 引用）在代码里也如实地留了 `TODO` 注释（`services/input_files.py:47`、`services/input_files.py:71`），没有被静默跳过或假装已完成。
- **Job/Task 子系统（ADR-0005）、MCP Task Server 聚合（ADR-0007）相关的脚手架**：目前代码库里完全没有 `jobs` 表、Taskiq 集成、Task Server 静态地址表、`/internal/jobs/{job_id}/complete` 端点的任何痕迹。这与 ADR-0005/0007/0009/0010 里"尚未实现"的表述一致，不构成"半成品"问题——只是提醒后续设计者：目前没有任何可复用的骨架，需要从零设计，且应优先解决发现 1、2 里指出的鉴权与事务边界问题，否则 Job 子系统会直接建在这些坑上。

---

## 小结（按严重度排序）

| 严重度          | 发现         | 一句话                                                                                                                                              |
| --------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🔴 阻塞后续工作 | 发现 1       | 两套独立的 JWT 验证实现、算法硬编码互相矛盾（RS256 vs EdDSA），`/mcp` 被双重鉴权且测试掩盖了这个组合，REST 业务端点在生产环境可能对合法令牌返回 401 |
| 🟡 应尽快重构   | 发现 2       | repository 的 DB 事务/行锁跨越了对 SeaweedFS 的网络调用，Job 子系统若照搬会把 Postgres 事务跨在 Taskiq 入队调用上                                   |
| 🟡 应尽快重构   | 发现 3       | 空的 `models/` 包与 `db/models.py` 同名不同实，目录结构具有误导性                                                                                   |
| 🟡 应尽快重构   | 发现 5       | repository 层没有独立于 SeaweedFS 的测试路径，纯持久化逻辑的测试成本被不必要地推高                                                                  |
| ⚪ 轻微         | 发现 4、6、7 | 数据表示层数偏多（尚可接受）、安全头重复添加、MCP/REST 能力面暂不对等                                                                               |
