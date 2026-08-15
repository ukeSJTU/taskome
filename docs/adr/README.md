# Architecture Decision Records

This directory records the architectural decisions that were genuinely contentious — where more than one viable option existed and the reasoning behind the one chosen is worth preserving. It does **not** describe what the system currently is or does; that's [`docs/architecture/`](../architecture/). An ADR only exists because, without it, a future reader might reasonably re-litigate a decision or reverse it without understanding the trade-off that was already considered.

Every ADR here follows the [MADR](https://adr.github.io/madr/) template (`./template.md`): Context and Problem Statement, Decision Drivers, Considered Options, Decision Outcome (with Consequences and Confirmation), Pros and Cons of the Options, and More Information.

## Index

| ADR                                                          | Title                                                                                                | Status   |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | -------- |
| [0001](./0001-schema-per-service-data-ownership.md)          | Schema-per-service data ownership in one shared Postgres instance                                    | Accepted |
| [0002](./0002-identity-and-access-channels.md)               | Channel-specific credentials, normalized into one identity model at Gateway                          | Accepted |
| [0003](./0003-task-kit-task-server-framework.md)             | task-kit as a shared library, with compute logic and infrastructure split into separate ports        | Accepted |
| [0004](./0004-gateway-owned-job-dispatch.md)                 | Gateway durably queues Jobs, brokers Ray resources, then dispatches synchronously to the Task Server | Accepted |
| [0005](./0005-seaweedfs-storage-and-presigned-urls.md)       | Self-hosted SeaweedFS for object storage, with direct client access via presigned URLs               | Accepted |
| [0006](./0006-frontend-deployable-and-package-boundaries.md) | apps/web hosts the public site and the product together; apps/docs is the one deliberate exception   | Accepted |
| [0007](./0007-internal-service-hmac-signing.md)              | HMAC-signed internal requests, not mTLS, for service-to-service calls                                | Accepted |

## Numbering and status lifecycle

- Numbers are sequential (`0001`, `0002`, …) and never reused, even if an ADR is later superseded.
- `status` lives in each file's frontmatter: `proposed` while still under discussion, `accepted` once decided, `deprecated` if the decision no longer applies and nothing replaced it, or `superseded by ADR-NNNN` if a later ADR explicitly replaces it.
- A superseded ADR stays in this directory — don't delete it. Its frontmatter and a note at the top of the file point to whatever replaced it, so the history of _why_ stays readable.
- Before writing a new ADR, check whether the decision actually belongs here: if there's only one reasonable option, or the reasoning is already fully captured in a `docs/architecture/` page, it's documentation, not a decision record.

## Starting a new ADR

Copy `./template.md`, number it one past the highest existing ADR, and fill in every section the decision actually needs — the template's brackets mark what to replace, and its own "optional element" comments mark what can be removed if it doesn't apply.
