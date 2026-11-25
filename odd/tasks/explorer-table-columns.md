# Explorer table columns
Bounded fix for table-column metadata lookup.
Source request: “Ok, pero entonces pásale los parámetros que requieren, ya que debería listo, debería poder desplegarse las columnas con sus tipos.”

## Specs
1. **S1** — “pásale los parámetros que requieren, ya que debería listo, debería poder desplegarse las columnas con sus tipos.” Ensure the column-schema request uses the database selected in the Explorer as well as the table and schema, so columns and types load for the same database as the listed tables.
2. **S2** — “Okay, pero agregale colores también, no solo bobachitas y agregales colores.” Use distinct theme-aware colors for type badges.
3. **S3** — “I don't want to read that much. Then the tips that's un mapeo of the tips tanto the Pogres, the MySQL, this Well Like, for abbreviature and most of the people, because we are mostly and the number of large. Also, the maximum 5 or 6 letters and keeping this budget.” Map common PostgreSQL/MySQL type names to readable abbreviations of no more than six characters, preserving the full type in the title.

## Tasks
- T1 — S1 — inline — commit: `5ecf914`; selected database is passed to the schema command and covered by the API regression test
- T2 — S2-S3 — inline — commit: `40b5523`; themed type abbreviations and grouped explorer rendering are covered by component tests; full frontend suite passed (289 tests)

## Log
- L1 — “Ok, pero entonces pásale los parámetros que requieren, ya que debería listo, debería poder desplegarse las columnas con sus tipos.”
- L2 — `getTableSchema` now receives the selected Explorer database and uses it to build the connection request; the focused regression passed (1 test), and `bun run test` passed (278 tests).
- L3 — “Okay, pero agregale colores también, no solo bobachitas y agregales colores.”
- L4 — “I don't want to read that much. Then the tips that's un mapeo of the tips tanto the Pogres, the MySQL, this Well Like, for abbreviature and most of the people, because we are mostly and the number of large. Also, the maximum 5 or 6 letters and keeping this budget.”
- L5 — Focused Explorer test passed (1 test, 11 assertions); full `bun run test` run initially timed out at the 30-second foreground limit. No retry was performed during that earlier run.
- L6 — “Ok, ahora genera los commits necesarios usando Conventional Commit.” The selected-database API change is in `5ecf914`; grouped metadata and abbreviated type badges with tests are in `40b5523`. Later full `bun run test` passed (289 tests). Slice boundary: `40b5523` (479 authored changed lines); the next slice contains sidebar integration and persisted layout controls. No PR was requested.
