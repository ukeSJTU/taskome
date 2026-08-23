# Domain docs

Engineering skills use Taskome's domain documentation when exploring the codebase.

## Before exploring

- Read `CONTEXT.md` at the repository root.
- Read relevant ADRs under `docs/adr/`.

If either location is absent, proceed silently. The `domain-modeling` skill creates or updates domain documentation when terminology or architectural decisions are resolved.

## Layout

Taskome uses a single domain context:

```text
/
├── CONTEXT.md
├── docs/
│   └── adr/
├── apps/
└── packages/
```

`CONTEXT.md` defines shared product terminology. `docs/adr/` records architectural decisions that apply across the repository.

## Use the glossary's vocabulary

When naming a domain concept in issues, specifications, code, or tests, use the term defined in `CONTEXT.md`. Avoid synonyms that the glossary explicitly rejects.

If a required concept is absent, reconsider whether existing terminology already covers it. Record genuine vocabulary gaps for the `domain-modeling` skill.

## Surface ADR conflicts

Explicitly identify output that contradicts an existing ADR and explain why the decision may need reconsideration.
