# Connection workspace visual refresh

Reference: User-provided desktop screenshot for the connections workspace.
Goal: Apply the reference's compact dark database-workbench styling to the existing connection screen while preserving its working interactions.

## Specs

1. User request: "implemeta este design para las conexiones". Implement the supplied connection workspace design in the app, preserving the existing connection and query/table functionality.
2. Reference-visible labels to preserve where they apply: "NEXUS STUDIO", "DATABASE", "development", "EXPLORER", "Filter explorer...", "Tables", "Table", "JSON", "Data", "Structure". The screenshot depicts a dark compact desktop workbench, connected-connection indicator, database selector and schema explorer on the left, tabs and a dense data grid on the right, plus a compact bottom data/structure and pagination bar.
3. User correction: "ya pero no veo que la seccion del sidebar y la de los tabs este en un isla con border-radius, aparte se repite 2 veces la bar de la parte superior". Put rounded bordered panels around the sidebar and main workspace, and consolidate the repeated top bars into one; S4-S5 specify its contents.
4. User clarification: "pero la parte izquierda de bar superior mantenlo como la imagen, con el icono, y aparte". Keep the appbar's left-side brand icon and label from the supplied reference.
5. User clarification: "q sea uno solo". Combine the brand icon, connection badge, and window controls into one top bar, matching the supplied reference.
6. User correction: "faltaria que tenga el mismo border-radius". Add the matching rounded outer frame shown in the supplied screenshot around the single top bar and connection workspace, retaining the rounded sidebar and main workspace panels.

## Tasks

- T1 — S1-S6 — Inline — Commits: 2be3b4e (initial), 10a203f (unified titlebar/panel follow-up); outer-frame correction commit pending. Implement the dark workbench visual framing, connection identity, explorer selection, tabs, data grid and footer while preserving existing behavior; apply the user's panel-radius, unified-titlebar, and outer-radius corrections.
- T2 — S1-S2 — Inline — Commit: 2be3b4e. Run focused tests/build and verify workspace behavior, then record evidence.

## Log

- L1: "implemeta este design para las conexiones" (with the supplied screenshot reference).
- L2: Verification evidence: `bun test --isolate test/connection-workspace.test.tsx` passed (75/75); `bun run build` passed with the existing large-chunk warning; `bunx --bun oxfmt --check` passed for the changed source/test files; `git diff --check` passed.
- L3: Commit `2be3b4e` assessed against `cb303575c44b556e8c3f282640bd1d8cd322fe44`: native risk medium, `reviewDue: false` (`under_budget`); no native review transaction was started.
- L4: User selected `feature-branch-chain`. PR slice 1 contains source commit `2be3b4e`, based on `cb303575c44b556e8c3f282640bd1d8cd322fe44`; PR slice 2 contains the bounded follow-up source commit `10a203f`, based on `4f235bb`; PR slice 3 will contain the outer-frame correction based on `f625101`. Keep earlier pre-existing `development` commits out of these slices. No push or PR was authorized.
- L5: Created local branch `feature/connection-workspace-visual-refresh` at `2be3b4e`; no remote mutation was performed.
- L6: User correction appended verbatim to S3; T1 reopened to give the sidebar and main workspace separate rounded borders and remove duplicate workspace branding.
- L7: User clarification appended verbatim to S4; retain the connection appbar's left brand icon/label from the reference.
- L8: User clarification appended verbatim to S5; unify the connection identity and window controls into one top bar, reopening T1.
- L9: Final follow-up checks: `bun test --isolate test/title-bar.test.tsx test/connection-workspace.test.tsx` passed (78/78); `bun run build` passed with the existing large-chunk warning; oxfmt and `git diff --check` passed. Existing query/React test warnings remain non-failing.
- L10: Follow-up commit `10a203f` assessed as medium (`reviewDue: false`, `under_budget`) against `4f235bb`; no native review transaction was started. Slice boundary recorded before the tracking-evidence commit; delivery remains local.
- L11: User correction appended verbatim to S6; T1 reopened to add the matching rounded outer frame shown in Image#5.
- L12: Outer-frame regression test observed RED before implementation and GREEN afterward. `bun test --isolate test/title-bar.test.tsx test/connection-workspace.test.tsx` passed (79/79); build passed with the existing large-chunk warning; oxfmt and `git diff --check` passed. The integration test confirms other routes do not receive the connection-only frame.
