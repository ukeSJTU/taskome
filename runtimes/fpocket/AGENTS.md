# fpocket Runtime

## Read by change type

- **Dependency or process boundary:** Before changing `pyproject.toml`, the
  compute environment, or the subprocess seam, read
  [`docs/architecture/components/tool-runtime.md`](../../docs/architecture/components/tool-runtime.md)
  and [`README.md`](README.md#keep-the-dependency-planes-separate).
- **Upstream identity:** Before changing fpocket versions, source lineage, or
  fixtures, read the upstream-tracking rules in the Runtime architecture and
  the characterization evidence in [`README.md`](README.md).
- **Image contract:** Before changing the Dockerfile, entrypoint, filesystem,
  user, or build context, read the image contract in the Runtime architecture
  and the implemented image behavior in [`README.md`](README.md).
- **Runtime tests:** Before designing or changing tests, read the Runtime section
  of [`docs/engineering/testing.md`](../../docs/engineering/testing.md) and use
  the `tdd` skill.

## Completion

Run the fast Runtime tests documented by the README for every adapter change.
Run its image tests when the Dockerfile, locks, compute environment, entrypoint,
filesystem behavior, or adapter-to-compute integration changes. Update the
README when upstream identity, supported behavior, qualification evidence, or
deferred work changes.
