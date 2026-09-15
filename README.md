# Nexus Studio

Nexus Studio is a focused desktop database manager for developers. Create and test saved connections, browse database objects, inspect table data and structure, and run SQL from one native application.

The project is under active development. The current implementation supports direct connections to PostgreSQL, MySQL, and SQLite. See [Current capabilities](docs/funcionalidades-actuales.md) for the complete scope and known limitations.

## Features

- Manage local connection profiles from a searchable dashboard.
- Connect directly to PostgreSQL, MySQL, and SQLite databases.
- Import direct connection strings and create SQLite database files.
- Browse tables, views, functions, and procedures where the database supports them.
- Inspect table data with pagination and view column structure.
- Write and execute SQL in CodeMirror-based tabs with syntax highlighting.
- Open routine definitions from the schema explorer.
- Switch between light and dark themes.
- Use keyboard shortcuts for common workspace actions.

## Quick Start

### Prerequisites

Install the following before starting development:

- [Bun](https://bun.sh/)
- [Rust](https://www.rust-lang.org/tools/install) and Cargo
- The platform dependencies required by [Tauri 2](https://v2.tauri.app/start/prerequisites/)

### Run locally

```bash
git clone https://github.com/eduardoquea3/nexus-studio.git
cd nexus-studio
bun install
bun run tauri dev
```

The Tauri development command starts the Vite frontend and opens the native application. To run only the frontend in a browser, use `bun run dev`.

## Development Commands

| Command | Purpose |
| --- | --- |
| `bun run tauri dev` | Start the desktop app in development mode. |
| `bun run dev` | Start the Vite frontend development server. |
| `bun run build` | Type-check and build the frontend. |
| `bun run tauri build` | Build and bundle the desktop application. |
| `bun test` | Run the test suite with Bun. |
| `bun run format` | Format TypeScript and TSX files with Oxfmt. |
| `bun run preview` | Preview the production frontend build. |

The repository also includes a `just dev` shortcut for `bun run tauri dev`.

## Using Nexus Studio

1. Open the app and select **New connection**.
2. Choose PostgreSQL, MySQL, or SQLite.
3. Enter the connection fields, or import a connection string.
4. Use **Test** to validate the connection before saving it.
5. Open a saved connection to explore its schema, inspect tables, or run SQL.

For SQLite, select an existing database file or use **Create new SQLite database**. An arbitrary missing path is not created automatically when testing a connection.

## Current Scope

The following areas are intentionally not presented as complete yet:

- SSH tunnels and SSH config aliases are not functional.
- SSL fields are present in the UI but are not sent to the backend.
- Table structure editing and adding rows are local-only operations; they do not execute DDL or `INSERT` statements.
- Data filtering, sorting, persisted inline editing, query cancellation, and the Rules tab are not implemented.
- Connection passwords are currently stored in the local connection profile. OS keychain integration is planned but not complete.

When using development builds, treat saved credentials as sensitive and use test or disposable database accounts where possible. SQL statements execute against the selected database with the permissions of the configured user.

## Project Structure

```text
src/
|-- app/          # Feature areas: home, connections, settings, and command bar
|-- routes/       # TanStack Router route definitions
|-- shared/       # Shared components, stores, types, and Tauri API wrappers
`-- test/         # Frontend unit and integration tests

src-tauri/
|-- src/          # Rust commands and database integrations
|-- capabilities/ # Tauri permissions and capabilities
`-- tauri.conf.json

docs/             # Product scope, plans, and keyboard shortcut documentation
DESIGN.md         # Kanso visual system and UI conventions
```

The Rust backend uses `sqlx` with PostgreSQL, MySQL, and SQLite drivers. Connection profiles are persisted through `tauri-plugin-store`; database operations are invoked from the frontend through Tauri commands.

## Documentation

- [Current capabilities](docs/funcionalidades-actuales.md): implemented features, partial areas, and limitations.
- [Product plan](docs/PLAN.md): planned architecture and milestones.
- [Keyboard shortcuts](docs/keymaps.md): shortcut design and implementation guidance.
- [Design system](DESIGN.md): visual language, semantic tokens, typography, and accessibility expectations.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/)
- [Tauri VS Code extension](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## License

No license has been published for this repository yet.
