Objective: Let users retain, remove, or replace built-in keyboard shortcuts from Settings.
Branch: `feature/shortcut-customization` | Delivery: `ask-on-risk` | Test runner: `bun run test`.

## Specs

### S1 — Edit the built-in shortcut bindings
> “Ahora, esa ventana de shortcuts también quiero que soporte el poder cambiar de shortcut, o sea, yo voy a poner unos shortcuts base de la aplicación, pero el usuario va a poder decidir si quiere continuar con esos, eliminarlos o usar otro shortcut. Ahí, al apretar doble click en el shortcut, en la vibración, debería abrir un pequeño o un componente encima con overlay que yo por defecto inicie capturando las keys que el usuario esta presionando y mostrarlas en mi ventana.”

Acceptance: the built-in shortcuts remain defaults; the user can keep a default, remove its binding, or set another binding. Double-clicking a binding opens an overlay already listening for key input, and the captured keys are shown live. Checks: UI tests cover opening capture, live chord display, save, removal, and restoring a default.

### S2 — Persist user changes locally
> “Sí, guardarlos localmente”

Acceptance: custom and removed bindings survive application restarts while defaults remain available to restore. Checks: store tests cover loading/saving overrides and treating a removed binding as intentionally unassigned.

### S3 — Reject shortcut conflicts
> “Rechazar y explicar (Recomendado)”

Acceptance: an attempted assignment already used by another action is not saved, and the user is told which binding conflicts. Checks: conflict tests assert that the conflicting override remains unchanged.

## Tasks

- T1 | S2-S3 | Add shortcut preference model, local persistence, and conflict validation with tests | route: inline | status: done | commit: `13abd40`; compatibility fix in `658787d`
- T2 | S1-S2 | Apply effective bindings to existing key handlers without changing their contexts | route: inline | status: done | commit: `658787d`
- T3 | S1-S3 | Add editable shortcuts UI, capture overlay, and settings tests | route: inline | status: pending | commit: —

## Log

- L1 (2026-11-20): “Ahora, esa ventana de shortcuts también quiero que soporte el poder cambiar de shortcut, o sea, yo voy a poner unos shortcuts base de la aplicación, pero el usuario va a poder decidir si quiere continuar con esos, eliminarlos o usar otro shortcut. Ahí, al apretar doble click en el shortcut, en la vibración, debería abrir un pequeño o un componente encima con overlay que yo por defecto inicie capturando las keys que el usuario esta presionando y mostrarlas en mi ventana.”
- L2 (2026-11-20): User chose “Sí, guardarlos localmente” and “Rechazar y explicar (Recomendado)” for persistence and conflicts.
- L3 (2026-11-20): Existing key handlers are split across global, Home, workspace, and SQL editor code. Existing preference-store examples use the Tauri store plugin; preserve action contexts while moving effective bindings to a shared catalog.
- L4 (2026-11-20): Started T1; first define a validated persisted override model and conflict checks before routing runtime handlers or building the capture UI.
- L5 (2026-11-20): T1 RED observed (catalog module missing), then GREEN: `bun run test src/test/shortcut-store.test.ts` passed 4 tests/14 assertions and targeted Biome lint passed. Commit `13abd40`; committed-range assessment: medium, `reviewDue: false` (`under_budget`). Started T2 to route runtime handlers through effective persisted bindings.
- L6 (2026-11-20): T2 verification first exposed a TypeScript compatibility error in T1's `Object.hasOwn` checks (`lib` target lacks ES2022), plus unsafe string indexing. Replaced those checks with supported own-key lookup; T1's catalog/store tests then passed (7 tests/28 assertions), and `bun run build` passed (with the existing large-chunk advisory). T2 targeted runtime tests passed (93 tests/388 assertions across five files, plus the updated connection-workspace suite at 82 tests/356 assertions).
- L7 (2026-11-20): During commit-scope review, a new regression test showed that switching from the default next-tab chord to a differently-modified customized previous-tab chord did not close the tab switcher on modifier release. RED reproduced it; updating the tracked shortcut identity on every accepted tab-switcher keydown made the focused test pass.
- L8 (2026-11-20): `bun run test` passed the full project suite (277 tests, 1,027 assertions across 34 files); `bun run build` passed with the existing large-chunk advisory; `git -c core.whitespace=cr-at-eol diff --check` passed. T2 was ready for its requested work-unit commit.
- L9 (2026-11-20): Committed runtime routing and context-specific regressions as `658787d` (`feat(shortcuts): route runtime handlers through overrides`), 13 files. T2's commit assessment against `13abd40` was medium with `reviewDue: false` (`under_budget`). The new source/test slice is verified; T3 remains pending.
