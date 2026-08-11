# AGENTS.md

## Project direction

## Engineering principles

- **Today's requirements:** Implement the least complex solution that satisfies today's requirements. Avoid abstractions, configuration, and indirection intended for hypothetical future needs.

- **Incremental delivery:** Begin with the smallest end-to-end version that works, then add capabilities without sacrificing a functioning product for unfinished complexity.

- **Module boundaries:** Keep modules independent, with clear responsibility boundaries.

- **Existing capabilities first:** Before writing custom code or installing another package, investigate what the project's existing dependencies already provide. Check their documentation and types first.

- **Mature dependencies:** Use mature, actively maintained libraries when they improve reliability or reduce total complexity. Avoid rebuilding standard functionality without a strong reason.

- **Prior art:** Before designing a solution, examine how established products address the same problem and reuse proven patterns and conventions.

- **Durable architecture:** Make architectural choices that remain sound over time. Keep roadmap-staged backends behind stable boundaries, and avoid temporary solutions that leak into product contracts.

- **Cleanup:** Remove outdated code paths instead of maintaining old behavior through compatibility shims, fallbacks, or migrations.

- **Licensing:** Treat third-party licensing as a release gate owned by Legal and Compliance, not as a reason to avoid the best-fit tool during development. Use only licenses or evaluation access currently authorized for the development context, record the dependency, and require Legal and Compliance approval before production use, external access, redistribution, or commercial release.

