# Connection tags and colors

Feature: Add colored tags to saved connections, filter by tags, and remove the list sort selector.
Scope: Connection create/edit, saved-connection list/card rendering, and list filtering.

## Specs

1. S1: “al momento de crear una nueva conexion, poder agregar tags y elegir un color” — support adding/removing tags and selecting one color for a connection in create/edit; tag suggestions include tags already used by saved connections. Improve the tag selector interaction and animate its transitions with GSAP.
2. S2: “poder distingir las conexiones” and “mejora el design de donde se coloca el badge del tag ya que esta q descuadra todo el design en la lista de conexion” — render theme-colored tags in a compact, aligned card-header row so they do not add a separate body row or shift connection details.
3. S3: “en los filtro usar los tags para filtrar” — show All and available-tag filters; selecting a tag shows matching connections.
4. S4: “remover el select/combo” — remove the “Recently opened” sort selector from the list.
5. S5: “Always sort by `last_opened_at` descending; ties/missing timestamps remain deterministic and do not reintroduce a user-selectable sort.”
6. S6: “Provide exactly nine fixed color choices.”
7. S7: Preserve the existing card hover changes in `src/shared/components/connection-card.tsx`.

## Tasks

- T1 | S1-S7 | inline | commit: none (not authorized) — Implement optional persisted connection metadata, create/edit tag UI and color palette, card rendering, tag filtering, deterministic recent-first ordering, and focused tests. Outcome: complete; 4 utility tests and one persistence test added.
- T2 | S1-S7 | inline | commit: none (not authorized) — Run repository tests/build and review final diff. Outcome: complete; `bun test --isolate` and `bun run build` pass; oxlint unavailable due missing package.
- T3 | S1-S2 | inline | commit: none (not authorized) — Replace hard-coded badge colors with theme tokens, improve the tag picker, and add GSAP transitions. Outcome: complete; persisted color tokens adapt to light/dark themes, listbox keyboard navigation and reduced-motion behavior are supported, and GSAP animates picker options, selected chips, and card badges.
- T4 | S1-S2 | inline | commit: none (not authorized) — Verify the tag picker and theme changes. Outcome: complete; user accepted automated checks only (`bun test --isolate`, 236 tests; `bun run build`; `git diff --check`) and waived browser visual verification because Orca lacks Python GTK/AT-SPI support.
- T5 | S2 | inline | commit: none (not authorized) — Move visible connection tags into a compact card-header row and avoid adding card-body height. Outcome: complete; `bun test --isolate` passes (236 tests), `bun run build` passes, and `git diff --check` passes.

## Routing and checks

- User authorized implementation continuation after the delegated writer returned `interaction_required`; the prior inline-edit blocker is resolved.
- TDD: `bun test --isolate`; RED observed when the new test imported the not-yet-created helper, then GREEN after implementation.
- Additional checks: `bun run build`, `git diff --check`.
- Delivery strategy: no commit, push, PR, or release was authorized.

## Evidence

- Branch: `feat/connection-tags-and-colors`.
- Added helper tests cover exactly nine distinct colors, case-insensitive de-duplicated tags and suggestions, filtering, and stable recent-first ordering.
- Persistence test covers optional tags and color; existing untagged profile saves remain covered by the existing save test.
- Existing local hover-style edits in `src/shared/components/connection-card.tsx` were preserved.
- `bunx --bun oxlint ...` could not run: `oxlint` is missing, and the config import failed. It made no repository lockfile changes.
- `bun run build` emitted the existing large-chunk warning (>500 kB), but completed successfully.
- Native `gentle_review assess` was attempted with RDD on after each implementation scope; it returned `nativeRisk: unassessable` because untracked files were not declared, with no `reviewDue` field and a plan requiring no independent verifier. No review transaction was started.
- Browser visual check was attempted through `orca-ide computer list-apps --json`; unavailable because its Python 3.15 runtime cannot load `python3-gi`/AT-SPI. No dependency was installed; user accepted tests/build instead.

## Log

- L1: retoma tags y colores
- L2: al momento de crear una nueva conexion, poder agregar tags y elegir un color para en la lista de conexiones /tmp/orca-paste-1793285491390-70c2c9e7-96d4-4ac0-b601-177238287c3a.png poder distingir las conexiones y en los filtro usar los tags para filtrar , y remover el select/combo
- L3: User clarified that “remover el select/combo” means the “Recently opened” sorting selector.
- L4: “Review the delivered subagent output and continue.”
- L5: /tmp/orca-paste-1793286725258-ecce7c05-db1b-4bd8-8ec3-99a6e83cc5af.png /tmp/orca-paste-1793286817489-ec1dd38c-b8ce-47b5-8a13-49f397944fb5.png
  mejora con frontend-design skill , de los badges que usen los colores del theme y mejora el select del tags usa gsap para agregar mas animaciones
- L6: /tmp/orca-paste-1793299427834-67487f88-e8fd-4e8d-a9e6-2ae6a295f706.png mejora el design de donde se coloca el badge del tag ya que esta q descuadra todo el design en la lista de conexion
