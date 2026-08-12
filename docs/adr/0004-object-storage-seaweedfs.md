# Job outputs go to SeaWeedFS, not Postgres

Job outputs (structure files, trajectories, sequences — potentially tens to hundreds of MB) are stored in SeaWeedFS, an S3-compatible object store, with the gateway's `jobs` table holding only a pointer/key. Business logic talks to storage through a plain S3 client against SeaWeedFS's S3 gateway, so swapping the backend later (e.g. a managed cloud object store) doesn't touch application code. Rejected storing outputs directly in Postgres — the row sizes involved are a poor fit for a relational database built for the `jobs` metadata itself.

## Considered options

- **MinIO** — the default self-hosted S3-compatible choice, but no longer actively maintained; rejected on that basis.
- **SeaWeedFS** (chosen) — actively maintained, S3-compatible gateway, single-binary self-hosted footprint.
