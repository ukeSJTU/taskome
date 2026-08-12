---
status: superseded by ADR-0013 (single-file mandate only; single-machine docker-compose deployment itself still stands)
---

# Deploy via docker-compose on a single machine; move to k8s only when multi-node GPU scheduling is needed

Web, gateway, and every Task Server deploy as docker-compose services on one machine — a local dev machine today, later a dedicated 8-GPU server — using the same compose file for both. We explicitly don't adopt Kubernetes now: at single-machine scale it adds real complexity (cluster control plane, manifests, GPU device-plugin setup) with no corresponding benefit, and the repo already has a working docker-compose convention (`docker-compose.yml`, `mise run docker:*` tasks) to build on rather than replace.

The trigger to move to k8s is needing to schedule GPU-bound work across more than one physical machine — not before. This isn't a redesign when it happens: the gateway's Task Server address list (ADR-0007) resolves via compose's service-name DNS today and would resolve via k8s Service DNS instead, with no application code change; each Task Server's container becomes a Deployment + Service; GPU allocation moves from compose's `deploy.resources.reservations.devices` to pod resource requests — infrastructure-manifest changes, not application changes.
