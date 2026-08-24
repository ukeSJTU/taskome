# Reference projects

`references/` contains pinned, read-only checkouts used to study external
projects while designing and implementing Taskome. These checkouts have no
release role: Taskome builds, tests, Runtime source identity, and product
contracts must not depend on them.

The study targets below are inferred from Taskome's current product direction
and each reference project's capabilities. They are a research agenda, not a
record that Taskome has adopted a reference's design. Update a row when the
research question changes or an accepted design moves into Taskome's own
documentation.

## Scientific software

| Project | What Taskome studies | Related Taskome area |
| --- | --- | --- |
| [`fpocket`](./fpocket) | The supported `fpocket` inputs, parameters, output files, scoring data, build requirements, and failure behavior needed to curate Pocket Detection without exposing the rest of the fpocket suite. | [Pocket Detection launch boundary](../docs/product/roadmap.md#launch-catalog) and [Tool Runtime packaging](../docs/architecture/components/tool-runtime.md) |
| [`bindcraft`](./bindcraft) | The end-to-end binder-design stages, target and hotspot inputs, scientifically useful controls, filters, generated structures and metrics, GPU/runtime requirements, and licensed dependencies needed for one curated Protein Binder Design Tool. | [Protein Binder Design milestone](../docs/product/roadmap.md#milestone-3-protein-binder-design) and [Tool Runtime packaging](../docs/architecture/components/tool-runtime.md) |
| [`pepmimic`](./pepmimic) | The known-binder interface-mimicry path, its complex and chain inputs, generation and ranking controls, outputs, checkpoints, runtime requirements, and licensed dependencies. Training and the no-known-binder RFDiffusion path remain outside Taskome's launch contract. | [Peptide Mimic Design milestone](../docs/product/roadmap.md#milestone-7-peptide-mimic-design) and [Tool Runtime packaging](../docs/architecture/components/tool-runtime.md) |
| [`pdb-tools`](./pdb-tools) | Small, composable PDB transformations such as chain and residue selection, renumbering, cleanup, and format conversion; where these operations belong in input preparation, a browser Utility, or a Tool's internal Runtime stages; and the format limits Taskome must expose. | [Provenance and files](../docs/product/requirements.md#provenance-and-files) and [Integrated Utilities](../docs/product/requirements.md#integrated-utilities) |

## Scientific platforms and agent access

| Project | What Taskome studies | Related Taskome area |
| --- | --- | --- |
| [`galaxy`](./galaxy) | Proven patterns from a mature scientific-compute platform for describing and discovering tools, validating inputs, scheduling jobs, tracking histories and datasets, managing object-backed files, recording job metrics, and separating tool definitions from execution infrastructure. Galaxy workflows do not change Taskome's launch decision to exclude Pipeline orchestration. | [Architecture overview](../docs/architecture/overview.md), [Runtime view](../docs/architecture/runtime.md), and [data ownership](../docs/architecture/data.md) |
| [`galaxy-mcp`](./galaxy-mcp) | How Galaxy maps tool discovery and execution, jobs, histories, datasets, files, and workflows into CLI and MCP operations; how remote MCP sessions isolate credentials; and how browser authorization, stdio, and Streamable HTTP are tested. Taskome uses these as interface prior art while preserving its own Tool, Job, Attempt, Project, and file semantics. | [MCP Agent requirements](../docs/product/requirements.md#mcp-agent) and [security boundaries](../docs/architecture/security.md) |
| [`biomcp`](./biomcp) | A shared, typed grammar across a conventional CLI and MCP server; progressive disclosure for agent-sized responses; structured errors and degraded-source reporting; tool/resource boundaries; packaging, release, and documentation patterns; and contract tests that keep multiple access surfaces aligned. Its biomedical evidence sources and scientific interpretation features are not part of Taskome's launch scope. | [Access channels](../docs/product/requirements.md#access-channels), [MCP Agent requirements](../docs/product/requirements.md#mcp-agent), and the [Taskome CLI](../apps/cli/README.md) |
| [`mcp-spec`](./mcp-spec) | The normative protocol schema and behavior for tools, resources, transports, lifecycle, authorization, errors, and compatibility. Use it to distinguish MCP requirements from conventions found in individual server implementations. | [MCP Agent requirements](../docs/product/requirements.md#mcp-agent) and [programmatic authorization](../docs/architecture/security.md#keep-programmatic-grants-explicit-and-revocable) |

## Product and implementation patterns

| Project | What Taskome studies | Related Taskome area |
| --- | --- | --- |
| [`old-website`](./old-website) | XDenovo's existing public copy, visual identity, motion, molecular graphics, assets, and legacy deployment behavior that may need to be preserved, deliberately replaced, or migrated into the new public site. | [Public XDenovo website](../apps/web/README.md) |
| [`restctl-template`](./restctl-template) | A focused Go/Cobra REST client structure: command and client boundaries, layered configuration, authentication headers, human and machine-readable output, errors and exit codes, dry-run behavior, completion, tests, and release automation. | [Taskome CLI](../apps/cli/README.md) and [CLI requirements](../docs/product/requirements.md#cli) |
| [`github-cli`](./github-cli) | A mature Go CLI's command hierarchy, dependency injection, authentication and configuration UX, REST/GraphQL client boundaries, pagination, prompts, output formatting, accessibility, extensions, shell completion, and cross-platform release practices. | [Taskome CLI](../apps/cli/README.md) and [CLI requirements](../docs/product/requirements.md#cli) |
| [`oras`](./oras) | Go CLI patterns for reliable large-file transfer, progress and cancellation, local filesystem handling, credentials, digests, immutable content, and supply-chain verification. Its OCI registry model is relevant prior art for Runtime artifacts, not an adopted Taskome user-facing storage contract. | [Taskome CLI](../apps/cli/README.md) and [Tool Runtime source and image identity](../docs/architecture/components/tool-runtime.md) |
| [`perses`](./perses) | Operator-facing observability UX, dashboard-as-code, typed dashboard models, embeddable React panels, plugin boundaries, and a production Go/React application structure. Taskome has not yet selected an observability backend, so this remains candidate prior art. | [Observability](../docs/engineering/observability.md) and the [authenticated console](../apps/console/README.md) |

## Work with pinned references

Use the repository's mise tasks for normal work. They wrap the submodule policy
defined in [`mise.toml`](../mise.toml).

```bash
# Initialize missing checkouts and restore every configured pinned revision.
mise run ref:sync

# Show the revision and state of every reference checkout.
mise run ref:status
```

In `ref:status` output, a leading `-` means the checkout is not initialized and
a leading `+` means it is not at the revision pinned by Taskome. Run
`mise run ref:sync` to restore the configured revisions.

Reference checkouts are read-only research material. If an experiment changes
files inside them, discard those changes and restore the pinned revisions:

```bash
mise run ref:reset
mise run ref:sync
```

`ref:reset` requires confirmation because it deletes untracked and ignored
files and discards tracked file changes inside every initialized reference.

## Change the reference set

Treat a pin change, addition, or removal as a focused maintenance change. Keep
the reference's purpose documented in the tables above and review submodule
changes before committing them.

### Update one pinned revision

The configured branch and shallow-clone policy live in
[`.gitmodules`](../.gitmodules). Fetch that branch's current revision, then
review the commit range recorded by the changed gitlink:

```bash
git submodule update --remote --recommend-shallow -- references/<name>
git diff --submodule=log -- references/<name>
mise run ref:status
```

### Add a reference

```bash
git submodule add --depth 1 --branch <branch> <url> references/<name>
git config --file .gitmodules submodule.references/<name>.shallow true
git diff --submodule=log -- .gitmodules references/<name>
```

Add the new project to this README in the same change.

### Remove a reference

```bash
git submodule deinit --force -- references/<name>
git rm -- references/<name>
git diff --submodule=log -- .gitmodules references/<name>
```

Remove its table row in the same change. Deinitializing removes the local
checkout; the committed removal takes effect only after the `.gitmodules` and
gitlink changes are reviewed and committed.
