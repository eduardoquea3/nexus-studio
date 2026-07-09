# DB Connection Manager — App Specification

A desktop app (Tauri + Rust backend, web-frontend) for managing database
connections (direct or via SSH tunnel) and browsing/querying the selected
database, similar in spirit to TablePlus / DBeaver.

---

## 1. Tech Stack

| Layer            | Choice                                                                 |
|-------------------|-------------------------------------------------------------------------|
| Shell             | Tauri 2.x                                                              |
| Backend           | Rust                                                                    |
| DB drivers        | `sqlx` (Postgres, MySQL, SQLite) — async, one crate for all             |
| SSH               | `russh` (tunnel) + `ssh2-config` (parse `~/.ssh/config`)                |
| Secrets           | `keyring` crate (OS keychain: Keychain / Credential Manager / Secret Service) |
| Local persistence | `tauri-plugin-store` (connection profiles, non-secret data)             |
| Frontend          | React (or Vue/Svelte) + TypeScript                                     |
| Frontend state    | Zustand / Pinia / whatever fits the framework                          |
| UI components     | shadcn/ui or similar, + a code editor (Monaco or CodeMirror 6) for SQL  |
| Routing           | `react-router` (or framework equivalent), file-based or declarative    |

---

## 2. App Routes / Screens

```
/                          → Connections list (home)
/workspace/:connectionId   → Main DB workspace (sidebar + top DB selector + content area)
```

### 2.1 `/` — Connections List
- Grid/list of saved `ConnectionProfile`s (name, db type icon, host, tags).
- Actions per item: Connect, Edit, Duplicate, Delete, Test Connection.
- "New Connection" button → opens **ConnectionModal**.

### 2.2 ConnectionModal (dialog overlay on `/`)
Form with:
- **Name**, **Color/Tag** (optional, for visual grouping)
- **DB Type**: Postgres / MySQL / SQLite / (extensible)
- **Connect Mode** (tab or radio):
  - **Connection String** — single textarea, validated per db type.
  - **Fields** — Host, Port, Database, Username, Password (stored via keyring).
- **SSH Tunnel** (toggle: off / on):
  - **Source**:
    - *Manual* — Host, Port, User
    - *From `~/.ssh/config`* — dropdown of parsed `Host` aliases, auto-fills
      Host/Port/User/IdentityFile (still editable/overridable).
  - **Auth**:
    - *Password* — stored via keyring
    - *Key File* — file path (native file picker) + optional passphrase (keyring)
  - **Remote bind host/port** — defaults to `localhost:<db default port>`
    (i.e., what the SSH server sees as the DB address).
- **Test Connection** button (opens tunnel if needed, attempts a lightweight
  `SELECT 1` / driver ping, then closes) before saving.
- **Save** → persists profile (see §4) and closes the modal.

### 2.3 `/workspace/:connectionId` — Main Workspace
Layout:

```
┌─────────────────────────────────────────────────────────────┐
│  [ DB selector ▾ ]                    connection name/status │  ← top bar
├───────────────┬─────────────────────────────────────────────┤
│               │  Tabs: [ Data ] [ Query ] [ Schema ] [ Rules]│
│   Sidebar     │                                               │
│  - Tables     │        (content area per active tab)         │
│  - Views      │                                               │
│  - Functions  │                                               │
│  - Other      │                                               │
│    (sequences,│                                               │
│    triggers,  │                                               │
│    indexes...)│                                               │
└───────────────┴─────────────────────────────────────────────┘
```

**Top bar — DB selector**: dropdown listing databases/schemas available on
the current connection (e.g. `SELECT datname FROM pg_database` for Postgres,
`SHOW DATABASES` for MySQL). Switching it re-queries the sidebar tree scoped
to the newly selected database/schema.

**Sidebar** — tree grouped by object type, lazily loaded per group:
- Tables
- Views
- Functions / Stored Procedures
- Other (Sequences, Triggers, Indexes, Extensions — DB-type dependent)
- Search/filter input at the top of the sidebar.
- Clicking a table/view selects it and switches the content area to the
  **Data** tab for that object.

**Content area tabs** (scoped to the selected object, except Query which is
connection/database-wide):

1. **Data** — paginated/virtualized data table of the selected table/view.
   - Inline cell editing (optional, phase 2), column sort, basic filter row.
   - Row count + pagination controls (LIMIT/OFFSET or keyset pagination).
2. **Query** — SQL editor (Monaco/CodeMirror with SQL syntax highlighting):
   - Run (Ctrl/Cmd+Enter), results grid below, multiple tabs for multiple
     queries, saved query history.
3. **Schema** — column list (name, type, nullable, default, PK/FK/unique),
   indexes, foreign key relationships (optionally a small ER diagram).
4. **Rules** — constraints, triggers, RLS policies / check constraints,
   depending on what the DB engine exposes.

---

## 3. Backend (Rust / Tauri) Architecture

### 3.1 Modules
```
src-tauri/src/
├── main.rs
├── commands/
│   ├── connections.rs   # CRUD for ConnectionProfile (store plugin)
│   ├── secrets.rs       # keyring get/set/delete wrappers
│   ├── ssh.rs           # tunnel start/stop, ~/.ssh/config parsing
│   ├── db.rs            # connect/disconnect, list databases, run queries
│   └── introspect.rs    # list tables/views/functions/schema/rules
├── models/
│   ├── connection.rs     # ConnectionProfile, ConnectMode, SshTunnelConfig...
│   └── db_meta.rs        # TableInfo, ColumnInfo, IndexInfo, etc.
├── state.rs              # AppState: active pools, active tunnels
└── ssh_tunnel.rs          # russh-based local port-forward implementation
```

### 3.2 App State (managed via `tauri::State`)
```rust
pub struct AppState {
    pub pools: Mutex<HashMap<String, sqlx::AnyPool>>,   // connectionId -> pool
    pub tunnels: Mutex<HashMap<String, TunnelHandle>>,  // connectionId -> tunnel
}
```

### 3.3 Key Tauri Commands (frontend-invoked)
```
list_connections() -> Vec<ConnectionProfile>
save_connection(profile) -> ()
delete_connection(id) -> ()
test_connection(profile) -> Result<(), String>

list_ssh_config_aliases() -> Vec<String>        # parses ~/.ssh/config

connect(id) -> ConnectResult                     # opens tunnel (if any) + pool
disconnect(id) -> ()

list_databases(id) -> Vec<String>
select_database(id, dbName) -> ()

list_tables(id) -> Vec<ObjectMeta>
list_views(id) -> Vec<ObjectMeta>
list_functions(id) -> Vec<ObjectMeta>
list_other_objects(id) -> Vec<ObjectMeta>

get_table_schema(id, table) -> TableSchema
get_table_rules(id, table) -> TableRules
get_table_data(id, table, page, pageSize, sort?, filter?) -> DataPage

run_query(id, sql) -> QueryResult
```

### 3.4 Data Model (persisted, non-secret)
```rust
struct ConnectionProfile {
    id: String,
    name: String,
    db_type: DbType,               // Postgres | MySql | Sqlite
    connect_mode: ConnectMode,      // ConnectionString | Fields
    ssh_tunnel: Option<SshTunnelConfig>,
}

enum ConnectMode {
    ConnectionString { value: String },
    Fields { host: String, port: u16, database: String, username: String, password_ref: Option<String> },
}

struct SshTunnelConfig {
    source: SshSource,              // Manual | FromSshConfigAlias
    auth: SshAuth,                  // Password | KeyFile
    remote_bind_host: String,
    remote_bind_port: u16,
}
```
`password_ref` / key passphrase are **IDs only** — actual secret values live
in the OS keychain via the `keyring` crate, never in the JSON store file.

### 3.5 SSH Tunnel Flow
1. Resolve `SshSource`:
   - `Manual` → use given host/port/user.
   - `FromSshConfigAlias` → parse `~/.ssh/config` with `ssh2-config`, resolve
     `HostName`, `Port`, `User`, `IdentityFile` for the chosen alias
     (support `ProxyJump`/`Include` if needed).
2. Authenticate via `russh`: password or private key (+ passphrase).
3. Bind an ephemeral local TCP port (`127.0.0.1:0`).
4. On each local connection, open a `direct-tcpip` channel to
   `remote_bind_host:remote_bind_port` and pipe bytes both directions.
5. Point the DB connection string at `127.0.0.1:<local_port>` instead of the
   real DB host (rewrite the connection string's host/port if in
   "connection string" mode).
6. On disconnect, close all channels, drop the listener, close the SSH
   session.

### 3.6 Query Execution
- Use `sqlx::Any` (or per-driver typed pools if you need driver-specific
  introspection queries) so `run_query` works generically.
- Cap default row fetch (e.g. 500 rows) with explicit "load more"/pagination
  to avoid freezing the UI on huge tables.
- Long-running queries should be cancellable (keep a handle to abort).

---

## 4. Frontend Architecture

```
src/
├── routes/
│   ├── index.tsx             # Connections list + modal state
│   └── workspace/
│       ├── index.tsx         # layout: TopBar + Sidebar + TabContent
│       ├── TopBar.tsx        # DB selector + connection status
│       ├── Sidebar.tsx       # tree: Tables/Views/Functions/Other
│       └── tabs/
│           ├── DataTab.tsx
│           ├── QueryTab.tsx
│           ├── SchemaTab.tsx
│           └── RulesTab.tsx
├── components/
│   └── ConnectionModal.tsx   # Create/edit modal (replaces old ConnectionForm route)
├── lib/
│   ├── tauriApi.ts           # thin wrappers around invoke()
│   ├── types.ts              # mirrors Rust structs
│   └── utils.ts              # cn() helper for shadcn
├── store/
│   ├── connectionStore.ts    # connection profiles + modal state (open/close, editingId)
│   └── workspaceStore.ts     # active connection, selected db, selected object, open tabs
```

### Suggested UX details
- Sidebar tree items are lazily fetched per section (don't load functions
  until "Functions" is expanded).
- Keep a small in-memory cache per `(connectionId, database)` for the
  sidebar tree so switching DB via the top selector doesn't always
  re-fetch from scratch.
- Query tab keeps its own independent state (multiple query tabs, each with
  its own result grid) — not tied to the currently selected sidebar object.
- Connection status indicator in the top bar (connected / reconnecting /
  tunnel active) improves trust, especially with SSH in the mix.

---

## 5. Security Notes
- Never write plaintext passwords/passphrases to disk — keyring only.
- Store only a reference/key in `tauri-plugin-store`'s JSON file.
- Validate/escape everything going into the SQL editor's *metadata* queries
  (table/column names from introspection) — use parameterized queries for
  data tab filters, and quote identifiers per-driver rules for structural
  queries.
- SSH known_hosts verification: don't silently accept unknown host keys —
  prompt the user (TOFU) or read from the system's known_hosts file.

---

## 6. Suggested Build Order (milestones)
1. Connection CRUD (fields + connection string mode, no SSH) + keyring wiring.
2. Direct DB connect + `list_databases` + basic sidebar (tables only) + Data tab.
3. Query tab with SQL editor + results grid.
4. Views/Functions/Other in sidebar + Schema tab.
5. Rules tab (constraints/triggers/policies).
6. SSH tunnel: manual host/port/user + password auth.
7. SSH: key-file auth + `~/.ssh/config` alias parsing/autofill.
8. Polish: connection status, cancel long queries, saved query history, inline data editing.
