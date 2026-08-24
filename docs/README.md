# Project documentation

This directory contains Taskome's internal product, architecture, and
engineering documentation.

## Product

- [`product/vision.md`](product/vision.md) defines the problem, audience, and
  product scope.
- [`product/requirements.md`](product/requirements.md) defines the launch
  requirements.
- [`product/roadmap.md`](product/roadmap.md) describes the planned delivery
  sequence.
- [`../CONTEXT.md`](../CONTEXT.md) defines the domain vocabulary used across the
  repository.

## Architecture

- [`architecture/overview.md`](architecture/overview.md) is the starting point
  for understanding the system.
- [`architecture/`](architecture) contains the system context, containers,
  runtime, data, security, deployment, integrations, and risks.
- [`adr/`](adr) records accepted architectural decisions. Create each ADR from
  [`adr/template.md`](adr/template.md).

## Engineering

- [`engineering/coding-standards.md`](engineering/coding-standards.md) defines
  coding standards that tooling cannot enforce.
- [`engineering/testing.md`](engineering/testing.md) defines test boundaries,
  suite placement, and fixture strategy.
- [`engineering/ci-cd.md`](engineering/ci-cd.md) documents continuous
  integration and delivery.
- [`engineering/observability.md`](engineering/observability.md) defines logging
  and telemetry standards.
- [`architecture/runbooks.md`](architecture/runbooks.md) links to operational
  procedures.

## Research

Use `docs/research/` for local research notes. Git ignores this directory; do
not commit its contents.

Product and architecture documents may describe an accepted target state ahead
of the implementation. Source code, executable configuration, migrations, and
the owning application's README describe the repository's current behavior.
