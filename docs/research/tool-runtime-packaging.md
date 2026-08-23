# Reproducible packaging for Tool Runtimes with uv, Conda, and OCI

> Research note, 2026-08-23. This page records source-backed findings and a
> concrete recommendation. It does not change the accepted Tool Runtime process
> boundary in [`tool-runtime.md`](../architecture/components/tool-runtime.md).

## Recommendation

Treat every `apps/tool-*` directory as one release unit with three different
owners inside it:

1. **uv owns Taskome code.** The package under `src/`, its unit tests, and its
   dependency metadata remain a normal uv project. `packages/toolkit` is also a
   uv-managed Python library.
2. **Conda owns the scientific runtime.** The upstream program, native
   libraries, Python scientific packages, and CUDA user-space packages are
   installed into one locked Conda prefix. fpocket can use the conda-forge
   package. BindCraft should become an internally built Conda package sourced
   from an approved upstream revision.
3. **OCI owns the deployable artifact.** The image contains the locked Conda
   prefix plus wheels built from Taskome's uv projects. Builds publish an image
   digest, SBOM, and signed provenance. Kubernetes receives the digest, never
   only a tag.

This corrects one sentence in the current architecture document: a Tool
application is not wholly “a uv Python project.” Its **Taskome-owned adapter** is
a uv project; its **runtime payload** is a separately locked Conda environment.

Do not run `uv sync` against the production Conda prefix. uv performs an exact
sync by default and removes packages absent from its lock, while an activated
Conda environment is one of the environments uv can discover. Combining those
behaviors would give two package managers authority over the same prefix
([uv sync behavior](https://docs.astral.sh/uv/concepts/projects/sync/),
[uv environment discovery](https://docs.astral.sh/uv/pip/environments/)). Build
Taskome wheels with uv, then install those wheels into the already-created
Conda prefix with `--no-deps`.

## Why the upstream installers are not release locks

The checked-out references already establish useful source identities:

| Upstream  | Taskome reference on 2026-08-23                                                                                                                 | What that proves                                                                                                                                                                                         |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| fpocket   | [`4bb0d8447f62fee77e2c3c29f54b5fcaf5e2c066`](https://github.com/Discngine/fpocket/commit/4bb0d8447f62fee77e2c3c29f54b5fcaf5e2c066), tag `4.2.3` | The reference matches an upstream release commit.                                                                                                                                                        |
| BindCraft | [`efb5bfeb8b4b1a5944256f979c34e0c8e6a82d9d`](https://github.com/martinpacesa/BindCraft/commit/efb5bfeb8b4b1a5944256f979c34e0c8e6a82d9d), `main` | The reference selects exact source, but it is newer than the latest tagged release visible during this review ([`v.1.5.3`](https://github.com/martinpacesa/BindCraft/releases/tag/v.1.5.3), `a234a8d…`). |

The superproject stores each submodule as a `gitlink` containing the exact
expected commit object. The `branch` field in [`.gitmodules`](../../.gitmodules)
helps update the reference; it does not make the checked-out gitlink float
([Git submodule model](https://git-scm.com/docs/gitsubmodules)). The existing
[`ref:sync` and `ref:status` tasks](../../mise.toml) therefore provide a sound
review surface for upstream code changes.

The references do not lock a runnable environment:

- fpocket's first-party instructions permit either compiling from source or
  installing `fpocket` from conda-forge. Its source build requires a C compiler
  and NetCDF, and its repository ships Qhull and VMD molfile components
  ([fpocket installation](https://github.com/Discngine/fpocket/blob/4bb0d8447f62fee77e2c3c29f54b5fcaf5e2c066/README.md#using-conda),
  [fpocket build requirements](https://github.com/Discngine/fpocket/blob/4bb0d8447f62fee77e2c3c29f54b5fcaf5e2c066/doc/INSTALLATION.md#dependencies)).
- BindCraft's installer creates Python 3.10, resolves broad package ranges from
  `conda-forge` and `nvidia`, installs ColabDesign from an unpinned Git branch,
  installs an unpinned PyRosetta artifact from an extra index, and downloads
  AlphaFold parameters without verifying a checksum
  ([installer lines 52–123](https://github.com/martinpacesa/BindCraft/blob/efb5bfeb8b4b1a5944256f979c34e0c8e6a82d9d/install_bindcraft.sh#L52-L123)).
  Re-running that script can therefore select different bytes without changing
  the BindCraft commit.
- BindCraft requires a CUDA-compatible NVIDIA GPU and documents that PyRosetta
  needs a commercial license for commercial use
  ([BindCraft installation](https://github.com/martinpacesa/BindCraft/blob/efb5bfeb8b4b1a5944256f979c34e0c8e6a82d9d/README.md#installation)).

The correct source of truth is consequently a set of linked identities, not one
version string: upstream commit, source archive hash, Conda package URLs and
hashes, model artifact hashes, Taskome commit, and final OCI digest.

## Separate source review from source acquisition

No single source mechanism covers both review ergonomics and release
availability. Use the existing submodules to review upstream changes, and use a
hashed package source to build releases.

| Option                                                          | What it locks                                                | Strength                                                                              | Limitation                                                                                                                          | Taskome decision                                                               |
| --------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Git submodule                                                   | The full upstream commit object recorded by the superproject | Normal Git history and diffs; the existing `references/` workflow already supports it | A dirty checkout can contaminate a local build; the remote can disappear; it does not identify model weights or binary dependencies | Keep for read-only review and for proving which upstream revision was approved |
| Conda recipe `url` plus SHA-256                                 | The exact downloaded source archive bytes                    | Hash verification fails closed if a tag or hosted file changes                        | The URL can disappear unless Taskome retains a mirror                                                                               | Preferred release source, backed by an authorized internal mirror              |
| Conda recipe `git_url` plus full `git_rev` and `content_sha256` | The commit and verified extracted tree                       | Works when upstream publishes no stable archive                                       | The build still needs a live Git server and clone behavior; submodules need separate handling                                       | Acceptable fallback while producing the internally retained archive            |
| Dockerfile `git clone` or `curl` of a branch/tag                | Whatever the remote resolves during that build               | Minimal setup                                                                         | Mutable resolution, weak review boundary, and network-dependent builds                                                              | Reject for release images                                                      |
| Copied/vendor source without upstream metadata                  | Only the copied files in Taskome's tree                      | Available with the repository                                                         | Loses upstream history and makes updates harder to audit                                                                            | Do not replace the current submodules with copied directories                  |

Git documents that the superproject's gitlink is the expected submodule commit
([Git submodule model](https://git-scm.com/docs/gitsubmodules)). Conda-build
documents pre-extraction archive hashing and post-extraction content hashing
([Conda-build source hashes](https://docs.conda.io/projects/conda-build/en/stable/resources/define-metadata.html#hashes)).

## Recommended repository layout

Keep the same shape for CPU and GPU Tools. Tool-specific runtime data stays
beside the adapter that releases it.

```text
packages/toolkit/
├── pyproject.toml
├── uv.lock
├── src/taskome_toolkit/
└── tests/

apps/tool-fpocket/
├── pyproject.toml                 # Taskome adapter package metadata
├── uv.lock                        # adapter + toolkit development/test lock
├── src/taskome_tool_fpocket/
├── tests/
│   ├── unit/
│   └── integration/
├── runtime/
│   ├── environment.yml            # human-edited Conda intent
│   ├── virtual-packages.yml        # explicit solver assumptions
│   ├── conda-lock.yml              # generated canonical lock
│   ├── conda-linux-64.lock         # generated image-build input
│   └── upstream.lock.toml          # source/package/model identities
└── Dockerfile

apps/tool-bindcraft/
├── pyproject.toml
├── uv.lock
├── src/taskome_tool_bindcraft/
├── tests/
│   ├── unit/
│   └── integration/
├── runtime/
│   ├── environment.yml
│   ├── virtual-packages.yml
│   ├── conda-lock.yml
│   ├── conda-linux-64.lock
│   ├── upstream.lock.toml
│   └── upstream-package/
│       ├── recipe.yaml             # internal BindCraft Conda package
│       └── patches/                # Taskome-owned, reviewed patches only
└── Dockerfile

references/
├── fpocket/                        # clean, pinned review checkout
└── bindcraft/                      # clean, pinned review checkout
```

Use independent uv locks for the two adapters. The repository's
[`pyproject.toml`](../../pyproject.toml) currently requires Python 3.14, while
BindCraft's upstream installer creates Python 3.10. A shared uv workspace lock
would couple those constraints without solving a current product need.
`packages/toolkit` must declare and test the oldest Python version required by a
supported Tool Runtime.

The adapter should invoke the upstream command through a narrow process seam.
It should not import arbitrary BindCraft internals into the uv unit-test
environment. Adapter unit tests can then run with uv and a fake process, while
runtime integration tests run in the image against the Conda-installed program.

## Package fpocket and BindCraft differently

### fpocket: consume the existing Conda package

The conda-forge channel publishes fpocket 4.2.3 for `linux-64`
([published files](https://anaconda.org/channels/conda-forge/packages/fpocket/files)).
Its feedstock recipe sources the upstream `4.2.3` archive by SHA-256, applies a
feedstock patch, and builds against NetCDF
([feedstock recipe at revision `528b404…`](https://github.com/conda-forge/fpocket-feedstock/blob/528b404de34e50cc9baf1ed5ad5974d5b88316cf/recipe/meta.yaml)).

Put a version constraint such as `fpocket=4.2.3` in `environment.yml`, but let
the generated lock choose and record the exact channel, platform, build, URL,
and package hash. Record the upstream commit and reviewed feedstock revision in
`upstream.lock.toml`. The package build is not byte-for-byte identical to the
unpatched upstream tree, so the feedstock revision and final package hash are
part of provenance.

Do not also compile `references/fpocket` in the image. The submodule is the
review and update surface; the exact Conda package is the runtime payload.

### BindCraft: produce an internal Conda package

The pinned BindCraft repository provides source, bundled executables, and an
imperative installer rather than a version-locked Conda package
([BindCraft installer](https://github.com/martinpacesa/BindCraft/blob/efb5bfeb8b4b1a5944256f979c34e0c8e6a82d9d/install_bindcraft.sh)). Package the
approved snapshot as `taskome-upstream-bindcraft` in an internal Conda channel.
Install it under a stable prefix such as `$PREFIX/share/taskome/bindcraft`, and
make its package version/build encode the approved upstream release or commit.

The committed Conda recipe should use one of these immutable inputs, in order of
preference:

1. an internally retained source archive with a SHA-256;
2. an upstream release archive with a SHA-256 and a mirrored copy; or
3. a Git URL with the full commit plus an extracted-content SHA-256.

Conda-build verifies an archive hash before extraction and supports a full
`git_rev` plus `content_sha256` for Git sources
([Conda-build source metadata](https://docs.conda.io/projects/conda-build/en/stable/resources/define-metadata.html#source-section)).
An internal archive makes the build independent of the continued availability
of GitHub. Generated `.conda` packages belong in the internal channel, not in
Git.

The existing submodule remains valuable: reviewers can inspect a normal Git
diff when `references/bindcraft` moves, and CI can prove the archive/recipe
corresponds to the approved gitlink. Do not edit the submodule. Put Taskome
patches in the owning application's recipe and include every patch in the
source-content identity.

## Use environment specs for intent and locks for identity

`environment.yml` is a human-edited input to a dependency solve. It can name
channels and version ranges, but creating an environment from it solves again.
Adding `nodefaults` prevents a developer's configured default channels from
silently entering that solve
([Conda environment files](https://docs.conda.io/projects/conda/en/stable/user-guide/tasks/manage-environments.html#creating-an-environment-file-manually)).

Use `conda-lock` to produce the release lock:

- `conda-lock.yml` is the canonical generated lock and can represent multiple
  target platforms.
- `conda-linux-64.lock` is a rendered explicit lock consumed by the image build.
  An explicit Conda file installs without invoking the solver and consists of
  concrete package URLs with hashes
  ([Conda explicit locks](https://docs.conda.io/projects/conda/en/stable/user-guide/tasks/manage-environments.html#create-explicit-lockfiles-without-creating-an-environment),
  [conda-lock output formats](https://conda.github.io/conda-lock/output/)).
- Generate only `linux-64` initially. Add `linux-aarch64` as a separate target
  only after that runtime, its upstream binaries, and its GPU stack are
  supported. A lock from one Conda subdirectory does not describe another.
- Commit `virtual-packages.yml` so `__glibc`, `__archspec`, and, for BindCraft,
  `__cuda` are reviewable solve inputs. Conda's `__cuda` value represents the
  maximum CUDA version supported by the host display driver; it is not a CUDA
  toolkit package
  ([Conda virtual packages](https://docs.conda.io/projects/conda/en/stable/user-guide/tasks/manage-virtual.html)).
  conda-lock includes virtual package specifications in its input hash and
  recommends committing them for stable lock inputs
  ([conda-lock virtual package specification](https://conda.github.io/conda-lock/flags/#virtual-package-spec)).

The practical choice can be summarized as follows:

| File/tool                 | Role                                                               | Re-solves at image build        | Commit to Git                           | Decision                                                              |
| ------------------------- | ------------------------------------------------------------------ | ------------------------------- | --------------------------------------- | --------------------------------------------------------------------- |
| `environment.yml`         | Human-reviewed channels and direct constraints                     | Yes, if used alone              | Yes                                     | Keep as intent; never use alone for a release image                   |
| `conda-lock.yml`          | Generated canonical resolution, including target platform records  | No when installed by conda-lock | Yes                                     | Keep as the canonical machine-generated lock                          |
| `conda-linux-64.lock`     | Rendered Conda `@EXPLICIT` package URLs and hashes                 | No                              | Yes, because the Dockerfile consumes it | Use as the initial Linux image-build input                            |
| `pixi.toml` + `pixi.lock` | Alternative manifest, multi-platform lock, tasks, and environments | No in locked/frozen mode        | Yes if Pixi is adopted                  | Defer until its extra environment model solves a demonstrated problem |

Conda-lock is the conservative choice for the first implementation because it
preserves the upstream Conda model and adds a release lock. Pixi is a credible
alternative: it stores per-platform resolutions in `pixi.lock`, models CUDA and
other system requirements, and supports locked/frozen installs
([Pixi multi-platform resolution](https://pixi.sh/latest/workspace/multi_platform_configuration/),
[Pixi system requirements](https://pixi.sh/latest/workspace/system_requirements/),
[Pixi locked installs](https://pixi.sh/latest/reference/cli/pixi/install/)).
Adopting Pixi would add a new environment manager and command surface to a repo
that already standardizes commands through mise. Reconsider it if multiple
incompatible feature environments become a real maintenance problem; do not add
it only to generate the first two locks.

## Keep unavoidable pip artifacts subordinate to Conda

Prefer a Conda package for every runtime dependency. For a pip-only dependency:

1. select an exact wheel or build a wheel from a full upstream commit;
2. retain that wheel in an authorized internal artifact store;
3. record its SHA-256;
4. preferably wrap the wheel in an internal Conda package so the Conda lock
   remains the only runtime lock; or
5. as an interim measure, install all hashed wheels with pip only after Conda
   has finished, then never mutate that prefix again.

Conda itself recommends installing as much as possible with Conda, running pip
after Conda, and recreating rather than subsequently mutating a mixed
environment
([Conda pip guidance](https://docs.conda.io/projects/conda/en/stable/user-guide/tasks/manage-environments.html#using-pip-in-an-environment)).
pip's hash-checking mode requires every direct and transitive requirement to be
pinned and hashed
([pip secure installs](https://pip.pypa.io/en/stable/topics/secure-installs/)).

Do not put a live VCS requirement such as ColabDesign's current
`git+https://...` install in a production build. pip can pin a full Git commit,
but hash-checking mode cannot verify a VCS checkout as a wheel artifact
([pip VCS commit pins](https://pip.pypa.io/en/stable/topics/vcs-support/),
[uv hash-checking restrictions](https://docs.astral.sh/uv/reference/settings/#require-hashes)).
Build and hash the wheel first.

Conda-lock can model a mixed `pip:` section, but its own documentation calls
that support experimental. It also warns that native Conda tools silently
ignore pip entries in rendered explicit locks
([conda-lock pip support](https://conda.github.io/conda-lock/pip/)). That makes a
single apparent lock unsafe for BindCraft unless CI proves how every pip
artifact is installed. Internal Conda packages avoid this ambiguity.

Taskome's own adapter and toolkit wheels are different: they come from the same
attested repository build, and `--no-deps` prevents their installer from
resolving or replacing anything in the Conda prefix. Their declared Python
dependencies still belong in `environment.yml`, and `pip check` in the finished
image should prove that the Conda-installed versions satisfy wheel metadata.

## Make the OCI digest the released Tool version

Pin every Dockerfile `FROM` image by digest. Tags are mutable; digest references
select the same image content on every pull
([Docker digest pinning](https://docs.docker.com/build/building/best-practices/#pin-base-image-versions)).

Add standard OCI annotations for the Taskome source and revision, plus
Taskome-specific annotations for identities the standard does not cover:

```text
org.opencontainers.image.source
org.opencontainers.image.revision
org.opencontainers.image.version
org.opencontainers.image.base.name
org.opencontainers.image.base.digest
com.xdenovo.taskome.upstream.revision
com.xdenovo.taskome.conda-lock.sha256
com.xdenovo.taskome.tool-protocol.version
```

The standard annotation meanings come from the
[OCI Image Specification](https://github.com/opencontainers/image-spec/blob/main/annotations.md#pre-defined-annotation-keys).
Treat annotations as indexes, not proof: the signed attestation and digests
establish integrity.

BuildKit can attach SLSA provenance containing VCS metadata, source details,
build parameters, and materials, and can attach an SBOM to the image index
([BuildKit provenance](https://docs.docker.com/build/metadata/attestations/slsa-provenance/),
[BuildKit attestations](https://docs.docker.com/build/metadata/attestations/)).
Publish provenance with `version=v1`; use `mode=max` only after ensuring secrets
use BuildKit secret mounts rather than build arguments. Sign or attest the
published subject digest with the organization's selected trust system. GitHub's
current `actions/attest` action accepts a fully qualified image name and digest
and can push the attestation to the registry
([`actions/attest` container-image usage](https://github.com/actions/attest#container-image)).

The Tool catalog and Kubernetes Job must reference
`registry/name@sha256:...`. Kubernetes documents that a digest uniquely selects
the code even if a registry tag later moves
([Kubernetes image digests](https://kubernetes.io/docs/concepts/containers/images/#image-pull-policy)).
A human-readable tag is useful for discovery, but it is not the execution
identity.

Immutability and reproducibility are different claims. A digest proves which
bytes ran. Provenance proves how one build says it produced those bytes. A
separate repeat-build test is required before claiming that two builds from the
same inputs are byte-identical.

## Commit inputs and locks, publish heavy outputs

Commit these files to Git:

- Taskome `src/`, tests, `pyproject.toml`, and every uv lock;
- `.gitmodules` and the exact fpocket/BindCraft gitlinks;
- Conda `environment.yml`, `virtual-packages.yml`, canonical lock, and any
  rendered explicit lock consumed by a Dockerfile;
- internal Conda recipes and patches;
- `upstream.lock.toml`, including upstream repository, version/tag, full commit,
  source SHA-256, selected Conda package/feedstock identity, and immutable model
  artifact references;
- Dockerfiles with digest-pinned bases and deterministic smoke fixtures.

Do not commit these generated or heavyweight outputs:

- `.venv`, Conda prefixes, `.pixi`, and package caches;
- built wheels and `.conda` packages;
- AlphaFold weights or other model payloads;
- OCI layouts, image tarballs, SBOM blobs, signatures, or provenance blobs.

Publish wheels and Conda packages to retained artifact storage, model payloads
to a content-addressed authorized store, and images plus attestations to the OCI
registry. The deployment or Tool catalog records the promoted image digest.

## Update and verification workflow

An upstream update should be one reviewable change:

1. Select a release tag or full commit. Move the reference submodule and review
   the upstream diff. Do not build from a branch name.
2. Update `upstream.lock.toml`, the internal source archive/hash, recipe,
   patches, and model artifact manifest together.
3. For fpocket, review the conda-forge feedstock changes as well as the upstream
   changes. For BindCraft, build and publish the internal Conda package to a
   staging channel before resolving the Tool environment.
4. Regenerate the Conda lock for each supported Linux platform using the pinned
   conda-lock version and committed virtual package specification. Review every
   package, channel, build, and pip-origin change.
5. Build the image from the explicit lock and Taskome wheels. Run contract,
   fixture, and upstream smoke tests. Qualify BindCraft on an actual supported
   GPU/driver pair.
6. Publish the image, SBOM, and provenance. Verify the signature/attestation,
   then promote the resulting image digest into the Tool catalog.

CI should fail when any of these checks fail:

- a reference worktree is dirty or its checkout differs from the superproject
  gitlink;
- `upstream.lock.toml` disagrees with the gitlink, source archive hash, recipe,
  or model manifest;
- regenerating uv or Conda locks changes the tree;
- a runtime channel is unapproved, `defaults` enters the solve, or a private
  channel credential appears in a lock;
- a Dockerfile base, network download, VCS dependency, Conda package, pip wheel,
  or deployed image lacks an immutable digest/hash;
- `conda list --explicit`, `pip check`, the wrapper contract tests, or the
  upstream sample smoke test fails in the finished image;
- the image lacks the expected labels, SBOM, provenance, or trusted signature;
- the image-reported upstream revision, lock hash, protocol version, and
  Taskome revision do not match the release inputs.

For fpocket, run the sample structure test shipped by upstream in addition to a
Taskome adapter fixture. For BindCraft, separate a cheap image/import smoke test
from the GPU qualification suite; the latter must cover the exact CUDA runtime,
driver baseline, GPU architecture, PyRosetta artifact, and model weights being
promoted.

## Unresolved risks and decisions

- **Choose the approved BindCraft source.** The current submodule points to an
  exact post-release `main` commit, not the latest tag. Product/Science must
  choose whether the first supported artifact follows `v.1.5.3` or the reviewed
  commit already pinned.
- **Set the GPU compatibility contract.** The Conda lock needs an explicit
  `__cuda` assumption, but nodes also need a compatible NVIDIA driver and GPU
  architecture. NVIDIA documents minimum driver families and limitations for
  CUDA minor-version compatibility
  ([CUDA compatibility](https://docs.nvidia.com/deploy/cuda-compatibility/minor-version-compatibility.html)).
- **Approve PyRosetta use and retention.** BindCraft states that commercial use
  requires a license. Legal and Compliance must approve use, redistribution,
  internal mirroring, and image inclusion before release.
- **Identify and license bundled executables.** The pinned BindCraft tree
  contains prebuilt Linux x86-64 `dssp` and `DAlphaBall.gcc` executables but does
  not identify their source revision or license beside them
  ([`dssp`](https://github.com/martinpacesa/BindCraft/blob/efb5bfeb8b4b1a5944256f979c34e0c8e6a82d9d/functions/dssp),
  [`DAlphaBall.gcc`](https://github.com/martinpacesa/BindCraft/blob/efb5bfeb8b4b1a5944256f979c34e0c8e6a82d9d/functions/DAlphaBall.gcc)). They need
  their own provenance and architecture decision before the internal Conda
  package is a releasable artifact.
- **Hash and govern model weights.** The upstream installer checks only that the
  AlphaFold tar can be opened and that one extracted file exists. Decide whether
  weights live inside the image or in immutable external artifact storage, and
  record a verified SHA-256 either way.
- **Retain third-party package bytes.** Conda and pip hashes prevent silent byte
  substitution, but public channels can remove old artifacts. Production-grade
  rollback requires an authorized internal mirror or retention cache for every
  locked package.
- **Define the image signing authority.** BuildKit provenance alone is not an
  organizational trust policy. Decide the accepted OIDC issuer/workflow or key,
  registry retention policy, and admission-time verification before production.
- **Avoid overstating reproducibility.** The proposed locks and digests make a
  release auditable and replayable while artifacts remain available. They do not
  yet prove bit-for-bit reproducible image builds.

## Related architecture

- [`Tool Runtime and packages/toolkit`](../architecture/components/tool-runtime.md)
- [`Runtime execution flow`](../architecture/runtime.md)
- [`Container architecture`](../architecture/containers.md)
- [`Deployment architecture`](../architecture/deployment.md)
- [`CI/CD`](../engineering/ci-cd.md)
