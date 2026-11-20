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

- T1 | S2-S3 | Add shortcut preference model, local persistence, and conflict validation with tests | route: inline | status: in_progress | commit: —
- T2 | S1-S2 | Apply effective bindings to existing key handlers without changing their contexts | route: inline | status: pending | commit: —
- T3 | S1-S3 | Add editable shortcuts UI, capture overlay, and settings tests | route: inline | status: pending | commit: —

## Log

- L1 (2026-11-20): “Ahora, esa ventana de shortcuts también quiero que soporte el poder cambiar de shortcut, o sea, yo voy a poner unos shortcuts base de la aplicación, pero el usuario va a poder decidir si quiere continuar con esos, eliminarlos o usar otro shortcut. Ahí, al apretar doble click en el shortcut, en la vibración, debería abrir un pequeño o un componente encima con overlay que yo por defecto inicie capturando las keys que el usuario esta presionando y mostrarlas en mi ventana.”
- L2 (2026-11-20): User chose “Sí, guardarlos localmente” and “Rechazar y explicar (Recomendado)” for persistence and conflicts.
- L3 (2026-11-20): Existing key handlers are split across global, Home, workspace, and SQL editor code. Existing preference-store examples use the Tauri store plugin; preserve action contexts while moving effective bindings to a shared catalog.
- L4 (2026-11-20): Started T1; first define a validated persisted override model and conflict checks before routing runtime handlers or building the capture UI.
