# How Tabularis loads a table over a direct or SSH connection

Expanding a table starts **three application requests**: `get_columns`, `get_foreign_keys`, and `get_indexes`. They read database catalogs, not the table's data. SSH changes the route to the database, not the SQL. The same three requests can translate into more than three SQL statements, depending on the driver.

## What happens at each click?

| Event | Work performed |
| --- | --- |
| Open a connection | Test connectivity. Load the table list for the initial database/schema alongside other supported object lists. This is the separate `get_tables` call, not one of the three table-detail calls. |
| Expand another database or schema | Load its object lists on demand. The provider tracks loaded/loading state so the same branch need not be fetched on every click. |
| Expand one table | Start all three requests with `Promise.all`, passing the connection ID, table name, and schema when present. The component waits for the set before showing the result. |
| Expand **Keys** or **Indexes** inside that table | No database request. Group index rows locally. **Keys** shows primary/unique indexes and foreign keys; **Indexes** uses the whole index list. Columns carry their own primary-key flag. |
| Collapse and reopen the table | Request the three sets again. Table detail is local component state, not the database/schema list cache. A schema-version change also refreshes an expanded table. |

The table list itself comes from `information_schema.tables` in PostgreSQL and MySQL/MariaDB (filtered to the selected schema), or `sqlite_master` in SQLite (excluding internal tables). The main saving is **not fetching every table's details just to draw the tree**. Parallel dispatch overlaps waits when the pool and server allow it; it does not make the network round trip shorter.

## How SSH reuse works

```text
Direct:  database driver ───────────────────────────────► database host:port
SSH:     database driver ► 127.0.0.1:local_port ► SSH bastion ► database host:port
```

1. **Resolve the transport before calling the driver.** With SSH enabled, the Rust backend looks up a tunnel by SSH user, bastion host/port and destination database host/port. A configured SSH proxy contributes to the key. The destination is the database as reachable **from the bastion**, not from the desktop.
2. **On a miss, create a local forward.** Bind to loopback on an available local port. The system SSH path uses the equivalent of `ssh -N -L 127.0.0.1:LOCAL_PORT:DB_HOST:DB_PORT user@bastion`: forward TCP, don't start a remote shell. It checks the child and waits for the listener. The in-process Rust path authenticates an SSH session and opens a forwarding channel per accepted local TCP connection. A ready listener is not proof of database authentication; the database connection test is separate.
3. **On a hit, reuse the port.** The backend copies the connection parameters and replaces the database host/port with `127.0.0.1:local_port`. The driver still speaks its normal database protocol and uses database credentials. The three metadata calls do not each spawn an SSH process or authenticate a new SSH session.
4. **Keep the layers distinct.** A tunnel carries TCP connections; a database pool manages authenticated database connections. Multiple pooled connections can share one tunnel. The [MySQL and PostgreSQL pool manager](./src-tauri/src/pool_manager.rs) reuses a matching pool; for saved connections its key incorporates the connection ID, database and driver-specific settings. Normal disconnect closes the database pool but does **not** remove the SSH tunnel; the [app shutdown path](./src-tauri/src/lib.rs) stops remaining tunnels.

**For your own implementation:** establish the forward before dispatching concurrent metadata calls. Give one connection manager ownership of the tunnel and pool, and have concurrent callers await the same in-progress creation. Bind only to loopback, verify the bastion host key (pin it or confirm the first fingerprint; reject changes), and retain the database driver's TLS verification where required. Dispose of the pool and release the forward when its last consumer disconnects. These are implementation recommendations: a map hit in Tabularis is not itself a health check or a guarantee against simultaneous first opens. To evaluate the benefit, measure cold connect, first table expansion and opening **Keys** separately; the last action should issue no requests.

## The three requests, by driver

These are the built-in drivers' table-detail statements, not generic SQL for every plugin. Use bound schema/table values with PostgreSQL and MySQL. SQLite examples use literal names for clarity.

### MySQL / MariaDB

**1. Columns and primary-key membership.** Bind database and table; `column_key = 'PRI'` marks a primary-key column.

```sql
SELECT column_name, data_type, column_type, column_key, is_nullable, extra, column_default, character_maximum_length, NULLIF(column_comment, '')
FROM information_schema.columns
WHERE table_schema = ? AND table_name = ?
ORDER BY ordinal_position;
```

**2. Foreign keys.** Bind **database, table, database, table**. Filtering both catalog views independently lets MySQL 5.7 narrow discovery on both sides and avoids mixing table-scoped constraint names. Ordinal position preserves composite-key order.

```sql
SELECT
    kcu.CONSTRAINT_NAME,
    kcu.COLUMN_NAME,
    kcu.REFERENCED_TABLE_NAME,
    kcu.REFERENCED_COLUMN_NAME,
    rc.UPDATE_RULE,
    rc.DELETE_RULE
FROM information_schema.KEY_COLUMN_USAGE kcu
JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
WHERE kcu.TABLE_SCHEMA = ?
AND kcu.TABLE_NAME = ?
AND rc.CONSTRAINT_SCHEMA = ?
AND rc.TABLE_NAME = ?
AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY kcu.CONSTRAINT_NAME, kcu.ORDINAL_POSITION;
```

**3. Indexes.** Bind database and table. `INDEX_NAME = 'PRIMARY'` marks the primary index; `NON_UNIQUE = 0` marks uniqueness. Before reading indexes the driver checks whether this server exposes expression text:

```sql
SELECT COUNT(*)
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'information_schema'
AND TABLE_NAME = 'STATISTICS'
AND COLUMN_NAME = 'EXPRESSION';
```

If present, it runs:

```sql
SELECT
    INDEX_NAME,
    COLUMN_NAME,
    NON_UNIQUE,
    SEQ_IN_INDEX,
    EXPRESSION
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = ?
AND TABLE_NAME = ?
ORDER BY INDEX_NAME, SEQ_IN_INDEX;
```

Otherwise it runs the same query without `EXPRESSION` in the select list.

### PostgreSQL

Bind `$1` to the schema and `$2` to the table for each statement.

**1. Columns and primary-key membership.** The driver inserts its primary-key existence expression into the column query; it is expanded here.

```sql
SELECT
    c.column_name::text,
    -- information_schema reports extension/composite/enum types as the
    -- literal 'USER-DEFINED'; fall back to udt_name for the real type name
    -- (e.g. pgvector's 'vector', 'halfvec', 'sparsevec').
    CASE
        WHEN c.data_type = 'USER-DEFINED' THEN c.udt_name::text
        ELSE c.data_type::text
    END AS data_type,
    c.is_nullable::text,
    c.column_default::text,
    c.is_identity::text,
    c.character_maximum_length,
    d.description::text AS comment,
    (SELECT string_agg('''' || replace(e.enumlabel, '''', '''''') || '''', ',' ORDER BY e.enumsortorder)
     FROM pg_enum e
     JOIN pg_type t ON t.oid = e.enumtypid
     JOIN pg_namespace tn ON tn.oid = t.typnamespace
     WHERE t.typname = c.udt_name AND tn.nspname = c.udt_schema) AS enum_values,
    EXISTS (
        SELECT 1
        FROM pg_constraint pk_con
        JOIN pg_class pk_table ON pk_table.oid = pk_con.conrelid
        JOIN pg_namespace pk_schema ON pk_schema.oid = pk_table.relnamespace
        JOIN unnest(pk_con.conkey) AS pk_col(attnum) ON true
        JOIN pg_attribute pk_att
            ON pk_att.attrelid = pk_table.oid
            AND pk_att.attnum = pk_col.attnum
            AND NOT pk_att.attisdropped
        WHERE pk_con.contype = 'p'
            AND pk_schema.nspname = c.table_schema
            AND pk_table.relname = c.table_name
            AND pk_att.attname = c.column_name
    ) AS is_pk
FROM information_schema.columns c
JOIN pg_namespace n ON n.nspname = c.table_schema
JOIN pg_class pc ON pc.relnamespace = n.oid AND pc.relname = c.table_name
JOIN pg_attribute a ON a.attrelid = pc.oid AND a.attname = c.column_name
LEFT JOIN pg_description d
    ON d.objoid = pc.oid
    AND d.classoid = 'pg_class'::regclass
    AND d.objsubid = a.attnum
WHERE c.table_schema = $1 AND c.table_name = $2
ORDER BY c.ordinal_position;
```

**2. Foreign keys.** Pair source and referenced column numbers within the same constraint; exclude inherited child constraints.

```sql
SELECT
    con.conname::text AS constraint_name,
    src_att.attname::text AS column_name,
    ref_nsp.nspname::text AS foreign_schema_name,
    ref_cl.relname::text AS foreign_table_name,
    ref_att.attname::text AS foreign_column_name,
    CASE con.confupdtype
        WHEN 'a' THEN 'NO ACTION'
        WHEN 'r' THEN 'RESTRICT'
        WHEN 'c' THEN 'CASCADE'
        WHEN 'n' THEN 'SET NULL'
        WHEN 'd' THEN 'SET DEFAULT'
    END::text AS update_rule,
    CASE con.confdeltype
        WHEN 'a' THEN 'NO ACTION'
        WHEN 'r' THEN 'RESTRICT'
        WHEN 'c' THEN 'CASCADE'
        WHEN 'n' THEN 'SET NULL'
        WHEN 'd' THEN 'SET DEFAULT'
    END::text AS delete_rule
FROM pg_constraint con
JOIN pg_class src_cl ON src_cl.oid = con.conrelid
JOIN pg_namespace src_nsp ON src_nsp.oid = src_cl.relnamespace
JOIN pg_class ref_cl ON ref_cl.oid = con.confrelid
JOIN pg_namespace ref_nsp ON ref_nsp.oid = ref_cl.relnamespace
JOIN unnest(con.conkey, con.confkey) AS cols(src_attnum, ref_attnum) ON true
JOIN pg_attribute src_att
    ON src_att.attrelid = src_cl.oid
    AND src_att.attnum = cols.src_attnum
    AND NOT src_att.attisdropped
JOIN pg_attribute ref_att
    ON ref_att.attrelid = ref_cl.oid
    AND ref_att.attnum = cols.ref_attnum
    AND NOT ref_att.attisdropped
WHERE con.contype = 'f'
  AND con.conparentid = 0
  AND src_nsp.nspname = $1
  AND src_cl.relname = $2
ORDER BY con.conname, cols.src_attnum;
```

**3. Indexes.** Read primary/unique flags and key positions from the index catalog; recover expression text when there is no ordinary column name.

```sql
SELECT
    i.relname AS index_name,
    COALESCE(
        a.attname::text,
        pg_get_indexdef(ix.indexrelid, k.n::int, true)
    ) AS column_name,
    ix.indisunique AS is_unique,
    ix.indisprimary AS is_primary,
    k.n::int AS seq_in_index,
    (k.attnum = 0) AS is_expression
FROM
    pg_class t
    JOIN pg_namespace n ON t.relnamespace = n.oid
    JOIN pg_index ix ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    CROSS JOIN LATERAL unnest(string_to_array(ix.indkey::text, ' ')::int2[])
        WITH ORDINALITY AS k(attnum, n)
    LEFT JOIN pg_attribute a
        ON a.attrelid = t.oid
        AND a.attnum = k.attnum
        AND k.attnum <> 0
WHERE
    t.relkind IN ('r', 'm')
    AND n.nspname = $1
    AND t.relname = $2
ORDER BY
    i.relname,
    k.n;
```

### SQLite

For a table named `orders`, the equivalent sequence is:

```sql
-- 1. Columns. A positive pk value gives the column's position in the primary key.
PRAGMA table_xinfo('orders');

-- 2. Foreign keys, including local and referenced columns.
PRAGMA foreign_key_list('orders');

-- 3. Indexes: list indexes, read their DDL, then inspect each returned index.
PRAGMA index_list('orders');
SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = ?1;
PRAGMA index_info('idx_orders_customer'); -- example name returned by index_list
```

Bind `orders` to `?1`. The DDL lookup recovers expression-index text that the pragma doesn't return. SQLite is a local-file driver here, not an example of SSH transport. If adapting this code for arbitrary object names, use a parameterizable metadata interface or correctly quote names; don't substitute unchecked user input into PRAGMA strings.

## Source map

- [Table expansion, parallel dispatch and grouping](./src/components/layout/sidebar/SidebarTableItem.tsx): `refreshMetadata`, `groupIndexes`.
- [Connection opening and schema/database list loading](./src/contexts/DatabaseProvider.tsx): search for `test_connection` and `get_tables`.
- [Transport resolution and command dispatch](./src-tauri/src/commands.rs): `resolve_connection_transport`, `get_columns`, `get_foreign_keys`, `get_indexes`.
- [Tunnel creation and forwarding](./src-tauri/src/ssh_tunnel.rs): `new_system_ssh`, `new_russh`, `get_tunnels`.
- SQL and result mapping: [MySQL/MariaDB](./src-tauri/src/drivers/mysql/mod.rs), [PostgreSQL](./src-tauri/src/drivers/postgres/mod.rs), [SQLite](./src-tauri/src/drivers/sqlite/mod.rs). Each implements the three functions named above.
