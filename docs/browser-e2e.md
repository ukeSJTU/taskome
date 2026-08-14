# Browser E2E

Run `mise run test:browser-e2e` for the headless Chromium suite. Use `mise run test:browser-e2e:ui` to inspect and rerun journeys in Playwright UI, or `mise run test:browser-e2e:debug` for a headed Inspector session.

Every run provisions isolated disposable support services and unique ports, then Playwright manages the Web and Gateway processes. CI runs the production-shaped variant as its own blocking Browser E2E job, retaining reports, traces, screenshots, and service logs for 14 days.
