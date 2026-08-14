# Reference material

`references/` contains upstream projects and prior work used for research, evaluation, and product/design comparison. It is not part of Taskome's runtime source tree.

## Invariants

- Treat reference directories as read-only unless a task explicitly requests updating the reference itself.
- Extract behavior, constraints, or patterns into Taskome-owned code and documentation; do not add runtime dependencies on reference paths or copy implementation wholesale.
- Observe any nested `AGENTS.md`, `CLAUDE.md`, and upstream license notices while inspecting a reference project.

## Completion

- A Taskome change informed by reference material identifies its Taskome-owned implementation and any licensing/compliance consideration appropriate to the dependency or copied idea.
