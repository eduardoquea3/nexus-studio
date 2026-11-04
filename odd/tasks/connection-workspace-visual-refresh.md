# Connection workspace visual refresh
Reference: User-provided desktop screenshot for the connections workspace.
Goal: Apply the reference's compact dark database-workbench styling to the existing connection screen while preserving its working interactions.

## Specs
1. User request: "implemeta este design para las conexiones". Implement the supplied connection workspace design in the app, preserving the existing connection and query/table functionality.
2. Reference-visible labels to preserve where they apply: "NEXUS STUDIO", "DATABASE", "development", "EXPLORER", "Filter explorer...", "Tables", "Table", "JSON", "Data", "Structure". The screenshot depicts a dark compact desktop workbench, connected-connection indicator, database selector and schema explorer on the left, tabs and a dense data grid on the right, plus a compact bottom data/structure and pagination bar.

## Tasks
- T1 — S1-S2 — Inline — Commit: 2be3b4e. Implement the dark workbench visual framing, connection identity, explorer selection, tabs, data grid and footer while preserving existing behavior.
- T2 — S1-S2 — Inline — Commit: 2be3b4e. Run focused tests/build and verify workspace behavior, then record evidence.

## Log
- L1: "implemeta este design para las conexiones" (with the supplied screenshot reference).
- L2: Verification evidence: `bun test --isolate test/connection-workspace.test.tsx` passed (75/75); `bun run build` passed with the existing large-chunk warning; `bunx --bun oxfmt --check` passed for the changed source/test files; `git diff --check` passed.
- L3: Commit `2be3b4e` assessed against `cb303575c44b556e8c3f282640bd1d8cd322fe44`: native risk medium, `reviewDue: false` (`under_budget`); no native review transaction was started.
- L4: User selected `feature-branch-chain`. Current feature slice boundary: PR slice 1 contains only `2be3b4e`, based on `cb303575c44b556e8c3f282640bd1d8cd322fe44`; do not include earlier pre-existing `development` commits in this feature slice. No push or PR was authorized.
- L5: Created local branch `feature/connection-workspace-visual-refresh` at `2be3b4e`; no remote mutation was performed.
