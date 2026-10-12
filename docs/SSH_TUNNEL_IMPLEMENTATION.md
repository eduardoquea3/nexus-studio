# SSH tunnel implementation analysis

This document describes how Tabularis implements SSH tunneling for database connections, where platform-specific behavior appears, and which design choices are useful when building another SQL workspace. It reflects the current source tree; the SSH transport is an application-level layer, not a feature implemented separately by each database driver.

## At a glance

```text
Connection form / saved connection
  -> Tauri command expands the linked SSH profile and credentials
  -> transport resolver creates or reuses an SSH local forward
  -> database host/port become 127.0.0.1:<ephemeral port>
  -> the existing database driver connects normally
```

The SSH backend is selected by the available credentials, not by Linux, Windows, or macOS:

| Situation | Backend | Main tradeoff |
|---|---|---|
| A non-empty SSH password and no selected key | `russh` (Rust library) | No system `ssh` executable needed; does not use the user's OpenSSH config. |
| A selected key, or no password | System `ssh` (OpenSSH) | Uses the system SSH configuration and key/agent behavior; requires `ssh` to be executable from `PATH`. |

The rule is implemented by `should_use_system_ssh` in [`ssh_tunnel.rs`](src-tauri/src/ssh_tunnel.rs#L1039).

## Connection lifecycle

1. **Collect and persist SSH settings.** The UI can select a reusable SSH profile or enter SSH details inline in a database connection. Reusable profiles are managed from Settings or the connection modal ([`SshConnectionsManager.tsx`](src/components/ssh/SshConnectionsManager.tsx), [`NewConnectionModal.tsx`](src/components/modals/NewConnectionModal.tsx)).
2. **Expand the profile.** Database connections store `ssh_enabled` and, for a linked profile, `ssh_connection_id`. The backend loads that profile, retrieves any saved secrets, and fills the runtime SSH fields ([`models.rs`](src-tauri/src/models.rs#L118), [`commands.rs`](src-tauri/src/commands.rs#L145)).
3. **Resolve the transport.** Before invoking the database driver, `resolve_connection_transport` creates or reuses a tunnel. It returns otherwise unchanged connection parameters except that the database host and port point to `127.0.0.1` and the tunnel's local port ([`commands.rs`](src-tauri/src/commands.rs#L513)).
4. **Connect through the normal driver.** Drivers need no SSH-specific implementation: they receive a regular host/port and connect to the local forward.
5. **Keep and stop the tunnel.** Tunnels are cached in-process and reused for matching SSH/database endpoints. All tunnels are stopped on application exit; changing proxy configuration also stops cached tunnels ([`ssh_tunnel.rs`](src-tauri/src/ssh_tunnel.rs#L78), [`lib.rs`](src-tauri/src/lib.rs#L789), [`config.rs`](src-tauri/src/config.rs#L691)).

The cache key contains the SSH user/host/port and database host/port, plus the SSH proxy endpoint when configured. It does **not** contain the SSH profile ID or credentials, so profiles using the same endpoint can share a live tunnel.

## Tunnel backends

### System OpenSSH

Tabularis starts `ssh` as a child process with `-N -L 127.0.0.1:<local-port>:<db-host>:<db-port>`. `-N` requests forwarding without a remote shell. The app polls for the local listener, captures process output for diagnostics, and kills the process when the tunnel stops ([`ssh_tunnel.rs`](src-tauri/src/ssh_tunnel.rs#L228)).

When a key path is selected, the command passes it with `-i` and sets `IdentitiesOnly=yes`. Both SSH test and tunnel commands use `StrictHostKeyChecking=accept-new`. Because this is the system OpenSSH client, its configuration (including `~/.ssh/config`) can participate; this is why the system backend is also selected when no password is supplied.

The executable is launched as `Command::new("ssh")`; Tabularis does not bundle it or discover a platform-specific executable path. If it is missing or unavailable in the app's `PATH`, the operation fails with an actionable “Ensure 'ssh' is in PATH” error.

### Rust `russh`

For password-only connections, `russh` opens the SSH session and authenticates with password auth, falling back to keyboard-interactive when the server requests it. Tabularis binds a loopback listener itself; each accepted DB socket is forwarded through a `direct-tcpip` SSH channel to the database host ([`ssh_tunnel.rs`](src-tauri/src/ssh_tunnel.rs#L415), [`ssh_tunnel.rs`](src-tauri/src/ssh_tunnel.rs#L911)).

This backend does not invoke an external SSH process, so it avoids the OpenSSH `PATH` dependency. It does not read OpenSSH configuration or use its agent/ProxyJump behavior. Host keys are checked against `known_hosts`; an unknown key is accepted and learned (trust on first use), while a changed key is rejected.

### Interactive prompts for OpenSSH

OpenSSH can ask for a private-key passphrase, account password, security-key PIN, or physical key touch. Rather than requiring a desktop-specific `ssh-askpass` program, Tabularis points `SSH_ASKPASS` at its own executable. OpenSSH starts that executable in a small helper mode; it relays the prompt over a local IPC endpoint to the running app, which displays a modal and returns the answer ([`askpass/server.rs`](src-tauri/src/askpass/server.rs#L263), [`askpass/client.rs`](src-tauri/src/askpass/client.rs#L22), [`SshAskpassGate.tsx`](src/components/modals/SshAskpassGate.tsx)).

Saved password/passphrase values can satisfy matching prompts without opening the modal. The helper authenticates to the app with a per-server token; on Unix the socket is also restricted to the current user. Prompt responses time out after five minutes. If the app cannot start its prompt bridge, it falls back to `russh` only when the provided password/passphrase is sufficient for that backend; otherwise it reports the failure instead of relying on a missing system askpass program.

## Credentials and persisted settings

- Reusable profiles are written to `ssh_connections.json` under the app's configuration directory ([`commands.rs`](src-tauri/src/commands.rs#L677)). The base directory comes from `directories::ProjectDirs`, can be overridden by the app's custom storage location, and is platform-dependent ([`paths.rs`](src-tauri/src/paths.rs#L22)).
- With **Save in keychain** enabled, passwords and key passphrases are kept out of that JSON file and stored through the `keyring` crate; the file retains the profile metadata and key-file path. With it disabled, supplied password/passphrase fields are serialized in the JSON profile. Inline SSH secrets on saved database connections have analogous keychain handling.
- A selected private-key **path** is not itself copied into the keychain. The private key remains a local file and must be accessible on the machine running Tabularis.
- The configured keyring backends are Apple-native, Windows-native, and Linux-native persistent (`Cargo.toml`). Linux packaging can affect keyring access: the code includes a specific user hint for Snap when its password-manager plug is not connected ([`keychain_utils.rs`](src-tauri/src/keychain_utils.rs#L7)).

## Linux, Windows, and macOS differences

Most SSH/tunnel logic is shared. The explicit OS branches are concentrated in askpass IPC and process startup:

| Platform | Askpass IPC | Process / environment notes |
|---|---|---|
| Linux | Unix-domain socket, mode `0600`, plus token authentication. | `ssh` must be available in the app process's `PATH`. Snap/Flatpak confinement may add access constraints; the code currently has a targeted Snap keyring hint. |
| macOS | Same Unix-domain-socket implementation as Linux. The socket path is shortened to fit `sockaddr_un.sun_path` (maximum 103 path bytes in this code); it tries the temp directory and then `/tmp`. | `ssh` must be available in `PATH`. The in-app askpass bridge avoids OpenSSH's compiled-in `/usr/X11R6/bin/ssh-askpass` fallback. |
| Windows | A TCP listener bound only to `127.0.0.1` on an ephemeral port, protected by the same token protocol. | `ssh` must still be available in `PATH`. The child process is launched with `CREATE_NO_WINDOW` to avoid flashing a console window. |

These branches are in [`askpass/server.rs`](src-tauri/src/askpass/server.rs#L188), [`askpass/client.rs`](src-tauri/src/askpass/client.rs#L94), and [`ssh_tunnel.rs`](src-tauri/src/ssh_tunnel.rs#L90). In particular, macOS and Linux both compile through Rust's `cfg(unix)` path; there is no separate SSH tunnel algorithm for macOS.

The app's configuration directory also follows platform conventions. Windows explicitly removes the extra `config` leaf produced by `ProjectDirs`, keeping app files together under `%APPDATA%\tabularis`; a custom storage location can override the default on all platforms ([`paths.rs`](src-tauri/src/paths.rs#L8)).

## Design takeaways for another SQL workspace

1. **Keep tunneling below the driver boundary.** Resolve SSH into a local endpoint first, then let PostgreSQL/MySQL/etc. use their existing connection code. This avoids duplicating tunnel logic in every driver.
2. **Treat OpenSSH and an embedded SSH library as different capabilities.** OpenSSH provides user config and mature key/agent integration, but is an external dependency. An embedded library is easier to ship consistently but may not support all OpenSSH configuration features. Choose and document the routing policy deliberately.
3. **Make platform IPC a small adapter.** The prompt flow is platform-independent; only the local transport differs (Unix socket vs. loopback TCP). Keep authentication, secret handling, and UI events common.
4. **Test platform-sensitive constraints explicitly.** Tabularis tests the macOS Unix-socket path limit and the askpass protocol, and tests the backend-selection rule. For another app, add CI coverage for Unix and Windows builds, helper re-execution, path encoding, executable discovery, host-key behavior, and tunnel shutdown.
5. **Make host-key policy visible.** Tabularis currently uses accept-new / trust-on-first-use and rejects a changed known key. A SQL workspace should explain the first-use trust decision and avoid silently accepting changed keys.

## Source map

| Area | Main files |
|---|---|
| SSH profile model and database connection fields | [`models.rs`](src-tauri/src/models.rs), [`ssh.ts`](src/utils/ssh.ts) |
| SSH tunnel backends, authentication, host keys, cache key | [`ssh_tunnel.rs`](src-tauri/src/ssh_tunnel.rs) |
| DB transport resolution and Tauri commands | [`commands.rs`](src-tauri/src/commands.rs) |
| Askpass server/client and wire protocol | [`askpass/`](src-tauri/src/askpass/mod.rs) |
| Prompt modal and event queue | [`SshAskpassGate.tsx`](src/components/modals/SshAskpassGate.tsx), [`useSshAskpass.ts`](src/hooks/useSshAskpass.ts) |
| Keychain integration and platform features | [`keychain_utils.rs`](src-tauri/src/keychain_utils.rs), [`Cargo.toml`](src-tauri/Cargo.toml) |
| SSH and askpass tests | [`ssh_tunnel.rs`](src-tauri/src/ssh_tunnel.rs), [`askpass/tests.rs`](src-tauri/src/askpass/tests.rs), [`ssh.test.ts`](tests/utils/ssh.test.ts) |
