# Table data pagination

## Goal
Load table records in pages of 100, show current/total pages, and place pagination in a consistent compact bottom bar for both table browsing and SQL results.

## Tasks
1. Add page-aware table-data querying, retaining the 100-row page size. (Done)
2. Add table pagination controls and page/total-page status in the bottom bar. (Done)
3. Align table and SQL result bottom bars to the sidebar connection control height and remove row-count badges/text in favor of pagination. (Done)
4. Verify the updated footer placement, shared sizing, and focused checks. (Done)

## Evidence
- `src/app/connection/hooks/use-table-data.ts` includes page in the query key and sends the requested page with a fixed `pageSize: 100`.
- `src/app/connection/components/table-data-tab.tsx` places pager at bottom via `TableDataToolbar`; the former extra pagination row is removed.
- `src/app/connection/components/table-data-toolbar.tsx` replaces the total/shown row badges with the pager and uses the sidebar connection control height (`h-10 min-h-9 max-h-10`).
- `src/app/connection/components/query-result-view.tsx` uses the same `h-10 min-h-9 max-h-10` footer and only shows Page X of Y in its pager; JSON view retains its own page-range metadata.
- `bun test src/test/table-data-tab.test.tsx`: 18 passed, 0 failed.
- `bun test`: 133 passed, 0 failed. `bun run build` passed; Vite reported a large-chunk warning. `git diff --cached --check` passed.
- The page-count label includes “Page” to match the SQL result pager and its tests.
- Work-unit commit: `25a55e129c4d00c1eaac99f8c7ae5097c4172dbf` (`feat(connection): paginate table data`).
