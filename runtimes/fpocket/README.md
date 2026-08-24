# fpocket Runtime

This project packages fpocket as the Runtime for Taskome's Pocket Detection
Tool. The Runtime is under construction. It currently locks the upstream
compute environment, exposes the process-level Python seam needed to validate
fpocket execution, and assembles both dependency planes into an image skeleton.
It does not yet define the final Attempt entrypoint.

See the
[Tool Runtime architecture](../../docs/architecture/components/tool-runtime.md)
for the target image, Attempt, and publication contracts.

## Keep the dependency planes separate

| Plane              | Owner                                       | Current contents                                                    |
| ------------------ | ------------------------------------------- | ------------------------------------------------------------------- |
| Taskome adapter    | Root uv workspace                           | `fpocket_runtime` and `runtime_toolkit`                             |
| Scientific compute | `compute/pixi.toml` and `compute/pixi.lock` | fpocket 4.2.3 and its native dependencies for `linux-64`            |
| Upstream identity  | `compute/upstream.toml`                     | Discngine/fpocket commit `4bb0d8447f62fee77e2c3c29f54b5fcaf5e2c066` |

The adapter invokes fpocket as a subprocess. It does not import packages from
the Pixi prefix.

## Run the fast Runtime tests

The fast tests replace only the external `fpocket` executable. They do not
require Docker, Pixi, or scientific compute dependencies.

```bash
uv run --all-packages --frozen pytest runtimes/fpocket/tests/runtime
```

The tests exercise the Runtime Python interface and verify the subprocess
contract, failure reporting, and minimum technical output validation.

## Build and test the image skeleton

The image test requires Docker with `linux/amd64` execution support. Run it
from the repository root:

```bash
uv run --all-packages --frozen pytest runtimes/fpocket/tests/image
```

The test builds `taskome/fpocket-runtime:test` from
`runtimes/fpocket/Dockerfile`, then runs the real fpocket fixture through the
public `run_fpocket` interface. A successful run ends with `1 passed`.

The multi-stage build produces this final layout:

| Path                   | Contents                                                               |
| ---------------------- | ---------------------------------------------------------------------- |
| `/opt/taskome/adapter` | CPython environment containing `fpocket_runtime` and `runtime_toolkit` |
| `/opt/taskome/compute` | Locked fpocket compute prefix installed directly from `pixi.lock`      |
| `/work`                | Writable workspace owned by UID and GID 10001                          |

The final stage uses the pinned `linux/amd64` Python 3.14.7 slim image. It runs
as UID and GID 10001 and excludes uv, `pixi-install-to-prefix`, pip, build
caches, and compilers. The default command is `/bin/false`: the image fails
closed until the Attempt Invocation interface and final entrypoint are
designed.

The image test applies these runtime constraints:

- no network;
- a read-only root filesystem;
- all Linux capabilities dropped;
- `no-new-privileges`; and
- explicit writable `tmpfs` mounts for `/work` and `/tmp`.

The `/tmp` mount is required. fpocket 4.2.3 segfaults when the root filesystem
is read-only and no writable temporary directory is available. The fixture is
copied from upstream `data/sample/1UYD.pdb` at the commit in `upstream.toml` and
has SHA-256
`923e978e1d570f854d0d5f96d515f70d6fdac25216de586fe8c97a266e803b0c`.

## Locked upstream characterization

The following observations come from a real fpocket execution, not from the
fake executable used by the fast tests.

### Environment

| Property        | Value                                                                                          |
| --------------- | ---------------------------------------------------------------------------------------------- |
| Date            | 2026-08-24                                                                                     |
| Container       | `debian:bookworm-slim@sha256:abd67ffcfa541b485a3dff59865ab629aa048a6c613e639d36e7456b0b229241` |
| Platform        | `linux/amd64`                                                                                  |
| Pixi            | 0.77.0 Linux binary verified against `mise.lock`                                               |
| Install mode    | `pixi install --locked --no-config` from the committed compute lock                            |
| fpocket package | 4.2.3, conda-forge build `h5fd1fdb_2`                                                          |
| Input           | Upstream `data/sample/1UYD.pdb` at the commit recorded in `upstream.toml`                      |

The repository was mounted read-only. The compute files and input fixture were
copied into a writable container `tmpfs`, and the container was removed after
the run. This characterization path is not a supported host real-compute path
and does not qualify Runtime performance.

### Command

After installing the locked compute prefix, the successful case ran from the
input workspace:

```bash
fpocket -f input.pdb
```

The characterization also ran fpocket with a missing file, a PDB containing
no atoms, no arguments, and `--version`.

### Results

| Case              |           Exit code | stdout                                  | stderr                                    |
| ----------------- | ------------------: | --------------------------------------- | ----------------------------------------- |
| Valid `1UYD.pdb`  |                   0 | Pocket hunting begin/end messages       | Empty                                     |
| Missing PDB       |                   1 | Pocket hunting begin message            | Missing file and structure-reading errors |
| PDB with no atoms |                   1 | Pocket hunting begin message            | No-atoms and structure-reading errors     |
| No arguments      |                   0 | Usage text                              | Empty                                     |
| `--version`       | Not a version probe | Starts ordinary pocket-hunting behavior | Not reliable for provenance               |

The valid input created `input_out/` with 33 files:

- `input_info.txt`, `input_out.pdb`, and `input_pockets.pqr`;
- PyMOL and VMD helper files; and
- 13 detected pockets, each with one atom PDB and one vertex PQR file.

These counts describe the fixture, not a product invariant. A valid structure
can produce a different number of pockets.

### Runtime implications

- Exit code zero is necessary but not sufficient for success because the
  no-argument case also exits zero.
- The Runtime must validate expected non-empty outputs after the subprocess
  exits.
- Runtime provenance must use `upstream.toml` and `pixi.lock`; fpocket does not
  expose a reliable version command.
- The full upstream output directory is not yet the Taskome Job Output
  contract. Product output selection remains deferred.

## Cross-plane Runtime characterization

The process seam also passes a real end-to-end characterization across both
dependency planes:

```text
uv adapter environment
  -> fpocket_runtime.run_fpocket
  -> fpocket on PATH from the Pixi environment
  -> validated upstream outputs
```

### Environment

The characterization ran on 2026-08-24 in the same disposable
`linux/amd64` Debian container described above. The repository remained mounted
read-only. The test copied the minimum uv workspace, compute manifest, locks,
and `1UYD.pdb` fixture into container `tmpfs` before installation and execution.

| Plane              | Installation                                                                                        | Observed contents                                        |
| ------------------ | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Taskome adapter    | uv 0.12.1: `uv sync --frozen --no-dev --package fpocket-runtime` from the root `uv.lock`            | CPython 3.14.6, `fpocket-runtime`, and `runtime-toolkit` |
| Scientific compute | Pixi 0.77.0: `pixi install --locked --no-config` from `compute/pixi.toml` and committed `pixi.lock` | fpocket 4.2.3 and its locked native dependencies         |

The test placed the Pixi environment's `bin` directory first on `PATH`, then
called the public Python interface:

```python
from pathlib import Path

from fpocket_runtime import run_fpocket

result = run_fpocket(Path("/work/run/input.pdb"))
```

### Results

The call completed successfully through the real fpocket executable.

| Observation               | Result                                |
| ------------------------- | ------------------------------------- |
| Returned output directory | `/work/run/input_out`                 |
| `input_info.txt`          | Present and non-empty (7,290 bytes)   |
| `input_out.pdb`           | Present and non-empty (168,480 bytes) |
| `input_pockets.pqr`       | Present and non-empty (31,570 bytes)  |
| First stdout line         | `***** POCKET HUNTING BEGINS *****`   |
| Last stdout line          | `***** POCKET HUNTING ENDS *****`     |
| stderr                    | Empty                                 |

This result closes the functional integration gap between the uv adapter and
the locked Pixi compute environment for one known-good PDB fixture. It does not
define an image entrypoint, qualify performance, establish general PDB or mmCIF
compatibility, or turn the upstream directory into a product output contract.

## Deferred work

This project does not yet define the Attempt Invocation or Result schema,
Object Storage transfer, Job Output publication, curated parameters, mmCIF
behavior, the final image entrypoint, or real-compute qualification.
