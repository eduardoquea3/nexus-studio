# Grid data loading, pagination, and virtualization

This document describes how Tabularis currently loads query results and renders them in its grids.

## Database query and pagination

`@tanstack/react-table` is **not** responsible for fetching rows from the database or for server-side pagination. In `src/components/ui/DataGrid.tsx`, it is configured with the rows already held by the application (`tableData`) and `getCoreRowModel()`. The component uses it to model the table; the database execution and pagination flow live in the editor and Rust backend.

For the main editor result, `src/pages/Editor.tsx` runs the query through Tauri's `execute_query` command, passing `limit` (the resolved per-tab page size) and `page`. The page size is per-tab, falling back to the global Result Page Size. Choosing **All** disables pagination (`limit` is absent); it does not mean TanStack fetches chunks behind the scenes.

When the user changes page, the UI calls `runQuery` again with the requested page. That re-executes the same SQL statement through `execute_query`; it is a new database request, not a switch between pages previously cached in the frontend. The editor preserves the displayed total row count across page changes when available. The Rust drivers construct a paginated query using `LIMIT` and `OFFSET`, requesting one extra row to determine whether another page exists, then trim that sentinel row before returning the page. The shared helper is `src-tauri/src/drivers/common/query.rs::build_paginated_query`; built-in drivers use that pagination path for supported SELECT results. Explicit SQL `LIMIT` is retained as a cap across pages.

A total row count may initially be unknown. The page response communicates page, page size, and `has_more`; the UI can request a count separately. Thus normal paginated display loads one page at a time, not the complete result set. Selecting **All** or explicitly invoking operations that need every row (for example, copy-all) can trigger an unpaginated query and load all rows.

## What `@tanstack/react-table` does here

In `DataGrid.tsx`, `useReactTable` receives the current in-memory `tableData` and column definitions. It creates the core row model used to render the currently loaded rows and integrate the grid's table behavior. It is not configured with a pagination row model or manual/server pagination callbacks in this setup, and it does not issue SQL or Tauri calls. The application's pagination controls and `Editor.runQuery` own page changes and data fetching.

## What `@tanstack/react-virtual` does here

`useVirtualizer` controls **DOM rendering**, not database fetching. In `DataGrid.tsx`, it virtualizes the rows already in the current `tableRows`, using the grid's scroll element, a fixed estimated row height (`DATA_GRID_ROW_HEIGHT`), and `overscan: 10`. The grid positions the virtual rows within a spacer sized to the total virtual height, so scrolling shows the correct scrollbar while only nearby rows are mounted.

`MiniResultGrid.tsx` uses the same approach for query-result rows: row height estimate of 32 pixels and `overscan: 10`. It virtualizes whichever rows have already been passed to that component.

Virtualization therefore reduces the number of rendered row elements and associated UI work, but does not reduce the amount of data fetched from the database. Database pagination and UI virtualization are separate mechanisms and can operate together: the backend supplies one page, then the virtualizer renders the visible portion of that page. With **All**, the virtualizer can still limit mounted DOM rows, even though all result rows have been fetched into memory.

## Relevant implementation

- `src/pages/Editor.tsx` — `runQuery`, page-size resolution, page-change handlers, and `execute_query` invocation.
- `src/components/ui/DataGrid.tsx` — TanStack Table row model and virtualized main grid.
- `src/components/ui/MiniResultGrid.tsx` — virtualized compact result grid.
- `src/components/ui/PaginationControls.tsx` and `src/components/ui/PageSizeSelector.tsx` — pagination UI and page-size choices.
- `src-tauri/src/drivers/common/query.rs` — shared SQL pagination query construction.
- `src-tauri/src/drivers/{mysql,postgres,sqlite}/mod.rs` — built-in driver pagination and `has_more` handling.
