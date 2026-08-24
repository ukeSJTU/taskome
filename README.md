# Taskome

Taskome is XDenovo's platform for running, managing, and reproducing
protein-design compute. It gives scientists one product for submitting work,
tracking execution history, and working with scientific files through a browser,
an AI agent, a CLI, or a direct API client.

The repository currently contains the product foundations: the authenticated
console, control-plane server, CLI, public sites, shared packages, and an fpocket
Runtime skeleton. The complete scientific execution path described in the
architecture documentation is not implemented yet.

## Start local development

Install [mise](https://mise.jdx.dev/) and Docker, then run the setup task from the
repository root. Mise installs the pinned Node.js, pnpm, Go, Python, uv, and Pixi
toolchain; the task also installs dependencies and creates missing local
environment files.

```bash
mise run setup
mise run doctor
```

Start PostgreSQL, Temporal, object storage, the control-plane server, and the
authenticated console:

```bash
mise run dev
```

Open the console at [http://localhost:3001](http://localhost:3001). The API runs
at [http://localhost:3000](http://localhost:3000); a successful local start makes
[`/healthz`](http://localhost:3000/healthz) return a healthy response.

The public sites run separately:

```bash
mise run //apps/web:dev
mise run //apps/docs:dev
```

The marketing site uses [http://localhost:3002](http://localhost:3002), and the
public documentation site uses [http://localhost:4000](http://localhost:4000).

## Find your way around the repository

| Area             | Responsibility                                                               | Start here                                                                                     |
| ---------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `apps/console`   | Authenticated Taskome product experience                                     | [`apps/console/README.md`](apps/console/README.md)                                             |
| `apps/server`    | Authentication, REST API, and application data                               | [`apps/server/README.md`](apps/server/README.md)                                               |
| `apps/cli`       | Go command-line client                                                       | [`apps/cli/README.md`](apps/cli/README.md)                                                     |
| `apps/web`       | Public XDenovo marketing site                                                | [`apps/web/README.md`](apps/web/README.md)                                                     |
| `apps/docs`      | Public Taskome documentation site                                            | [`apps/docs/README.md`](apps/docs/README.md)                                                   |
| `apps/execution` | Reserved scaffold for the future Execution Service                           | [`docs/architecture/containers.md`](docs/architecture/containers.md)                           |
| `packages`       | Internal TypeScript and Python libraries shared by applications and Runtimes | [`packages/AGENTS.md`](packages/AGENTS.md)                                                     |
| `runtimes`       | Immutable environments for scientific Upstream Software                      | [`runtimes/fpocket/README.md`](runtimes/fpocket/README.md)                                     |
| `docs`           | Internal product, architecture, and engineering documentation                | [`docs/README.md`](docs/README.md)                                                             |
| `references`     | Read-only, pinned upstream research checkouts                                | [`docs/architecture/components/tool-runtime.md`](docs/architecture/components/tool-runtime.md) |

## Run common checks

```bash
mise run check
mise run test
mise run test:integration
mise run build
```

`check` is the read-only static gate. `test` runs service-free suites;
`test:integration` requires Docker. Run `mise tasks` to discover the complete
task surface instead of relying on a copied command list in this README.

## Read the project documentation

- [`docs/product/vision.md`](docs/product/vision.md) defines the product and its
  launch boundary.
- [`CONTEXT.md`](CONTEXT.md) is the canonical domain vocabulary.
- [`docs/architecture/overview.md`](docs/architecture/overview.md) explains the
  accepted target architecture and current implementation gap.
- [`docs/engineering/coding-standards.md`](docs/engineering/coding-standards.md)
  and [`docs/engineering/testing.md`](docs/engineering/testing.md) guide
  implementation work.
- [`AGENTS.md`](AGENTS.md) contains repository-wide instructions for AI agents.

## License

Taskome is licensed under the [MIT License](LICENSE).
