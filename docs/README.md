# Taskome repository documentation

This directory contains the internal product, architecture, and engineering
documentation used to design and build Taskome. It is different from the public
product documentation authored under [`apps/docs/content/docs`](../apps/docs/content/docs).

## Choose the right source

Taskome's target architecture is ahead of the implementation. Use the source
that matches the question you are answering:

| Question                                          | Authoritative source                                                                                                                           |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| What Taskome is and what launch includes          | [`product/vision.md`](product/vision.md), [`product/requirements.md`](product/requirements.md), and [`product/roadmap.md`](product/roadmap.md) |
| What a domain term means                          | [`../CONTEXT.md`](../CONTEXT.md)                                                                                                               |
| How the launch system is intended to fit together | [`architecture/overview.md`](architecture/overview.md) and the deeper architecture pages                                                       |
| What the repository implements today              | Source code, executable configuration, migrations, and the owning application or Runtime README                                                |
| How contributors should write and test code       | [`engineering/coding-standards.md`](engineering/coding-standards.md) and [`engineering/testing.md`](engineering/testing.md)                    |
| How AI agents should work in the repository       | [`../AGENTS.md`](../AGENTS.md), scoped `AGENTS.md` files, and [`agents/`](agents)                                                              |
| What external users should read                   | The MDX content in [`../apps/docs/content/docs`](../apps/docs/content/docs)                                                                    |

When current code and target architecture differ, describe the difference
explicitly. Do not present an accepted target as implemented behavior.

## Understand the product

Start with these pages when deciding what to build:

1. [`product/vision.md`](product/vision.md) — problem, audience, launch scope,
   and non-goals.
2. [`../CONTEXT.md`](../CONTEXT.md) — canonical vocabulary for Tools, Jobs,
   Attempts, Batches, Projects, files, and Utilities.
3. [`product/requirements.md`](product/requirements.md) — checkable launch
   behavior.
4. [`product/roadmap.md`](product/roadmap.md) — delivery order and milestones.

## Understand the architecture

- [`architecture/overview.md`](architecture/overview.md) gives the shortest
  system-level mental model.
- [`architecture/context.md`](architecture/context.md) defines the system
  boundary and external actors.
- [`architecture/containers.md`](architecture/containers.md) maps deployable
  responsibilities to repository locations.
- [`architecture/runtime.md`](architecture/runtime.md) explains Job and Attempt
  execution.
- [`architecture/data.md`](architecture/data.md),
  [`architecture/security.md`](architecture/security.md), and
  [`architecture/deployment.md`](architecture/deployment.md) cover their named
  concerns.
- [`architecture/components/`](architecture/components) contains deeper pages
  only for containers whose internals need another level of explanation.
- [`adr/`](adr) records accepted architectural decisions.

## Build and operate the repository

- [`engineering/coding-standards.md`](engineering/coding-standards.md) covers
  conventions that tooling cannot enforce.
- [`engineering/testing.md`](engineering/testing.md) defines public test seams
  and suite placement.
- [`engineering/ci-cd.md`](engineering/ci-cd.md) documents continuous
  integration and delivery.
- [`engineering/observability.md`](engineering/observability.md) defines logging
  and telemetry expectations.
- [`architecture/runbooks.md`](architecture/runbooks.md) routes operational
  procedures as they are added.

Application-specific setup and current behavior stay with the application:
see the repository [`README.md`](../README.md) for the complete map.

## Maintain these documents

Give each page one primary job. Link to an authoritative source instead of
copying its details, use relative links, and label target-only behavior near the
claim. Update related links when a page moves or its ownership changes.
