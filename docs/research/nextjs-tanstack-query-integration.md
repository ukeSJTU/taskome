# Next.js App Router 与 TanStack Query 的官方集成建议

研究日期：2026-08-13

## 结论

Next.js 与 TanStack Query 的官方资料没有规定“所有请求都走 TanStack Query”。两边的明确建议反而收敛到以下边界：

- Server Component（RSC）默认直接从数据源读取，不绕行本应用的 Route Handler。
- Server Action / Server Function 面向 mutation；不要把它用作 TanStack Query 的 `queryFn`。
- 浏览器侧确实需要轮询、后台刷新等 client-side server state 能力时，再在 Client Component 使用 React Query；需要隐藏内部服务或服务端凭据时，由 Route Handler 提供公开的 BFF 端点。
- 如果 Client Component 既要首屏服务端数据又要后续由 React Query 接管，可在 RSC 中 `prefetchQuery`，经 `dehydrate` / `HydrationBoundary` 交给客户端。
- 对一个新 RSC 应用，TanStack 官方明确建议先使用框架自带的数据获取工具，等出现真实需求后再引入 React Query；因此没有业务 query 时，单独提前加入 `QueryClientProvider` 并不是官方推荐的必要步骤。

这支持 Taskome 采用按场景混合的边界，而不是把 RSC、Server Actions 和 BFF 都统一包装成 TanStack Query。

## Next.js 的明确建议

### RSC 负责默认的服务端读取

Next.js 的 [Fetching Data](https://nextjs.org/docs/app/getting-started/fetching-data) 指南将 `fetch`、ORM 等异步 I/O 作为 Server Component 的直接数据来源；Server Component 可以安全保留凭据和查询逻辑，不把它们加入客户端 bundle。

[Backend for Frontend](https://nextjs.org/docs/app/guides/backend-for-frontend) 指南进一步明确：Server Component 应直接从源读取，不要调用本应用的 Route Handler。构建时没有 HTTP server 可供这种自调用；按需渲染时，自调用也会增加一次 HTTP 往返。

### Route Handler 是公开的 BFF/API 边界

同一份 [Backend for Frontend](https://nextjs.org/docs/app/guides/backend-for-frontend) 指南把 Route Handler 定义为公开 HTTP endpoint，可用于转换、聚合数据或代理后端；它要求自行完成认证、授权和输入验证。

### Server Actions 主要用于 mutation，不用于 query

Next.js 的 [Updating Data](https://nextjs.org/docs/app/getting-started/updating-data) 指南称 Server Functions 为服务端 mutation 而设计，并说明客户端目前会逐个 dispatch/await 它们；需要并行读取时，应使用 Server Component 数据获取，或在单个 Server Function / Route Handler 内并行执行。

[Backend for Frontend](https://nextjs.org/docs/app/guides/backend-for-frontend) 也直接说明 Server Actions 的主要用途是从前端修改数据；由于调用会排队，把它们用于读取会导致顺序执行。

### React Query 是 Client Component 的可选工具

[Fetching Data](https://nextjs.org/docs/app/getting-started/fetching-data#client-components) 把 React Query 与 SWR 列为 Client Component 的社区数据获取方案，并提示这些库有各自的缓存与 streaming 语义。

[Backend for Frontend](https://nextjs.org/docs/app/guides/backend-for-frontend) 给出的更具体场景是 client-only Web API 和频繁轮询的数据；对于这些场景，可以使用 React Query 或 SWR。

## TanStack Query 的明确建议

TanStack 的 [Advanced Server Rendering](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr) 是官方的 Next.js App Router / RSC 集成指南，包含以下明确建议：

- 把 Server Component 理解为 framework loader。
- 需要把同一份 query 交给 Client Component 时，在 RSC 中预取，再通过 `dehydrate` 和 `HydrationBoundary` 注入客户端 cache。
- 服务端应为请求创建新的 `QueryClient`；浏览器中复用一个稳定的 `QueryClient`。SSR 通常设置大于零的 `staleTime`，避免 hydration 后立即重复请求。
- 不建议把 Next.js Server Action 用作 `queryFn`。Server Action 的串行调度与 React Query 的并行 fetch/refetch 模型冲突；客户端 query 应 fetch API route，或使用 RPC 层。Server Action 仍可作为 mutation 的实现，并由 `useMutation` 调用。
- 避免让同一份会在客户端 revalidate 的数据同时由 RSC 输出和 Client Component 输出，否则客户端 query 更新后，RSC 输出不会自动同步。
- 从 React Query 的角度，应把 Server Component 当作“预取数据的地方，仅此而已”。
- 对新建的 RSC 应用，先使用框架提供的数据获取能力，直到确实出现 React Query 能解决而框架不能解决的场景；可能永远不需要引入它。

该指南还把“RSC 预取 + hydration”列为推荐方案；不预取、直接借助 `@tanstack/react-query-next-experimental` streaming 的方案仍明确标为 experimental。

## 官方 example / repo 的实际覆盖范围

### 有：TanStack 官方可运行的 App Router 示例

TanStack Query 官方仓库提供完整、可运行的 [nextjs-app-prefetching example](https://github.com/TanStack/query/tree/main/examples/react/nextjs-app-prefetching)。它展示了：

- `QueryClientProvider` 的 Client Component provider；
- 服务端与浏览器不同的 `QueryClient` 生命周期；
- RSC 中的 `prefetchQuery`；
- `dehydrate` / `HydrationBoundary`；
- Client Component 中的 `useSuspenseQuery`。

官方仓库也有 [nextjs-suspense-streaming example](https://github.com/TanStack/query/tree/main/examples/react/nextjs-suspense-streaming)，对应实验性的无显式预取 streaming 方案。

### 没有找到：覆盖 RSC + Server Actions + Route Handler/BFF + React Query 的官方整仓示例

上述 TanStack prefetching 示例只演示 query prefetch/hydration，并不包含 Server Action mutation 或 Route Handler/BFF。研究时也未在 Vercel 的 [Next.js examples](https://github.com/vercel/next.js/tree/canary/examples) 中找到由 Next.js 官方维护、覆盖这整套组合的 TanStack Query 示例。

因此，“按场景混合”是由双方明确边界组合出的架构结论，不是某个官方 repo 提供的一套固定目录模板。

## 对 Taskome 的应用（推论，不是逐字官方规范）

结合官方边界与 ADR-0012，建议采用下面的调用关系：

```text
RSC initial read -----------------------> server-only gateway adapter -> gateway
Server Action mutation ----------------> server-only gateway adapter -> gateway
Client Component + TanStack Query
  -> fetch /api/... Route Handler (BFF) -> server-only gateway adapter -> gateway
```

具体含义：

1. RSC 首次读取直接调用 `apps/web` 内的 server-only gateway adapter；不要在服务端绕到自己的 `/api`。
2. Job 轮询、后台刷新、客户端共享 cache 等需求，由 Client Component 的 TanStack Query 调用 `apps/web` Route Handler；浏览器不直接接触 gateway 或 gateway JWT。
3. 表单等 mutation 可优先用 Server Action。若客户端交互已由 React Query 管理，可用 `useMutation` 调 Server Action 或 Route Handler，但 mutation 成功后需要分别考虑两个缓存域：Next.js 的 revalidation 和 TanStack Query 的 query invalidation。两套 cache 不会自动彼此失效。
4. 如果 Job 详情需要 SSR 首屏内容并在浏览器继续轮询，使用官方的 RSC prefetch/hydration 模式；服务端 prefetch 与客户端 query 应共享 query key，但可以使用不同的调用实现（服务端 adapter 与浏览器 BFF）。
5. 第一次出现上述 client-side server state 需求时，再把 provider、query key、轮询停止条件和 invalidation 一起引入。现在若还没有真实 query，先配置空 provider 不会验证任何关键设计。

第 3、4 点是依据双方缓存边界作出的工程推论；官方资料没有提供可自动同步 Next Router/Data Cache 与 TanStack Query Cache 的统一机制。

## 主要一手资料

- Next.js: [Fetching Data](https://nextjs.org/docs/app/getting-started/fetching-data)
- Next.js: [Updating Data](https://nextjs.org/docs/app/getting-started/updating-data)
- Next.js: [Backend for Frontend](https://nextjs.org/docs/app/guides/backend-for-frontend)
- TanStack Query: [Advanced Server Rendering](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr)
- TanStack Query source: [Next.js App with Prefetching Example](https://github.com/TanStack/query/tree/main/examples/react/nextjs-app-prefetching)
- TanStack Query source: [Next.js Suspense Streaming Example](https://github.com/TanStack/query/tree/main/examples/react/nextjs-suspense-streaming)
