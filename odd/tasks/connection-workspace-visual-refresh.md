# Connection workspace visual refresh
Reference: User-provided desktop screenshot for the connections workspace.
Goal: Apply the reference's compact dark database-workbench styling to the existing connection screen while preserving its working interactions.

## Specs
1. User request: "implemeta este design para las conexiones". Implement the supplied connection workspace design in the app, preserving the existing connection and query/table functionality.
2. Reference-visible labels to preserve where they apply: "NEXUS STUDIO", "DATABASE", "development", "EXPLORER", "Filter explorer...", "Tables", "Table", "JSON", "Data", "Structure". The screenshot depicts a dark compact desktop workbench, connected-connection indicator, database selector and schema explorer on the left, tabs and a dense data grid on the right, plus a compact bottom data/structure and pagination bar.

## Tasks
- T1 — S1-S2 — Inline — Commit: pending. Implement the dark workbench visual framing, connection identity, explorer selection, tabs, data grid and footer while preserving existing behavior.
- T2 — S1-S2 — Inline — Commit: pending. Run focused tests/build and verify workspace behavior, then record evidence.

## Log
- L1: "implemeta este design para las conexiones" (with the supplied screenshot reference).
- L2: Verification evidence: `bun test --isolate test/connection-workspace.test.tsx` passed (75/75); `bun run build` passed with the existing large-chunk warning; `bunx --bun oxfmt --check` passed for the changed source/test files; `git diff --check` passed.
