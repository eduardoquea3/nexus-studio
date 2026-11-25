# Sidebar metadata and SSH
Adapt the reference behavior to Nexus Studio's existing drivers and tunnel manager.

## Specs
- S1 — «aplica la logica para los desplegables del sidebar»: list objects without fetching table details; fetch columns, foreign keys and indexes on expansion, group locally, reload on reopen, and isolate by database/schema.
- S2 — «y la conexion ssh»: metadata shares the existing managed forward; reuse must match the database destination as well as the SSH configuration.

## Tasks
- T1 | S1 | frontend + interaction tests | implemented and committed as `b38ff7a` (`feat(sidebar): wire metadata and persist layout preferences`); Explorer rendering is in `40b5523`; full frontend suite passed (289 tests); integration proof remains in T3
- T2 | S1,S2 | backend metadata and transport + Rust tests | implemented, committed as `5ecf914` (`feat(sidebar): fetch table metadata through managed SSH tunnels`). Scoped network pools, concurrent catalog reads, corrected PK/composite FK handling. Rust suite: 21 passed including SQLite composite and expression-index fixture. No live network-driver or SSH integration proof.
- T3 | S1,S2 | verify integration and preserve prior work | blocked: no live PostgreSQL/MySQL/SSH integration environment or credentials are available; independent static review found no confirmed defect but noted the catalog mappings and tunnel reuse/isolation lack direct coverage. Frontend build exceeded the 30-second foreground limit during Vite transformation; no retry.

## Log
L1: en base a @docs/SIDEBAR_METADATA_AND_SSH.md analizalo y aplica la logica para los desplegables del sidebar y la conexion ssh
L2: feature-branch-chain. Preserve pre-existing uncommitted edits. No global pool migration: scope is sidebar metadata and its SSH route.
L3: “Ok, ahora genera los commits necesarios usando Conventional Commit.”
L4: Slice 1 boundary: backend metadata and SSH transport committed as `5ecf914` (482 authored changed lines) with Rust/API tests. The high-risk backend unit is isolated; the next slice starts with explorer UI and sidebar integration. Keep follow-up commits local; no PR creation was requested. Verification: `cargo test` passed (21); frontend suite passed (289); `bun run build` exceeded the 30-second foreground limit during Vite transformation. Native review assess was unavailable (`package-local-binary-missing`).
L5: Slice 2 boundary: Explorer metadata rendering and compact SQL type badges committed as `40b5523` (479 authored changed lines), with component tests. The next slice starts with sidebar metadata wiring and persistent width/position preferences. Continue local Conventional Commits; no PR creation was requested.
L6: Slice 3 boundary: sidebar metadata wiring and persisted width/position preferences committed as `b38ff7a` (463 authored changed lines), with interaction, workspace and settings tests. The next slice is responsive connection controls and window minimum dimensions. Keep follow-up commits local; no PR creation was requested.
L7: Slice 4 boundary: responsive connection controls and the 1000×600 minimum window bounds committed as `282715e` (10 authored changed lines), with component regression tests. The next slice records commit evidence and current verification limits in these ODD task files. No PR creation was requested.
L8: Additional docs-only slice requested by the user: commit `docs/SIDEBAR_METADATA_AND_SSH.md` as a reference document, preserving its contents. No source changes, push, or PR are part of this slice.
