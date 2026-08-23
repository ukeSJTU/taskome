# Components

[`containers.md`](../containers.md) stops at the Container level: deployable units, their responsibilities, and how they depend on each other. This directory goes one level deeper — Component-level pages for a container whose internal structure is complex or important enough to need its own explanation. Not every container needs one; add a page here only when a container's internals raise questions `containers.md` can't answer on its own.

## Pages

- [`tool-runtime.md`](./tool-runtime.md) — how each Upstream Software Runtime is
  structured, what `runtime_toolkit` shares across Runtimes, and how a Tool
  Runtime cooperates with the Execution Service without calling it directly.
