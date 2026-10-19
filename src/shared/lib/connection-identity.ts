import type { ConnectionProfile } from "@/shared/types/models";

type ConnectionSaveMode = "create" | "update";

export class DuplicateConnectionError extends Error {
  constructor() {
    super("A connection with the same connection details already exists.");
    this.name = "DuplicateConnectionError";
  }
}

export async function createConnectionId(profile: ConnectionProfile): Promise<string> {
  const identity = new TextEncoder().encode(connectionIdentity(profile));
  const digest = await crypto.subtle.digest("SHA-256", identity);
  const fingerprint = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  return `connection-${fingerprint}`;
}

export function assertUniqueConnection(
  profiles: ConnectionProfile[],
  candidate: ConnectionProfile,
  mode: ConnectionSaveMode,
): void {
  const hasDuplicate = profiles.some((profile) => {
    if (mode === "update" && profile.id === candidate.id) return false;
    return connectionIdentity(profile) === connectionIdentity(candidate);
  });

  const hasIdCollision = mode === "create" && profiles.some(({ id }) => id === candidate.id);
  if (hasDuplicate || hasIdCollision) {
    throw new DuplicateConnectionError();
  }
}

export function hasSameConnectionIdentity(
  left: ConnectionProfile,
  right: ConnectionProfile,
): boolean {
  return connectionIdentity(left) === connectionIdentity(right);
}

function connectionIdentity(profile: ConnectionProfile): string {
  const connectMode =
    profile.connect_mode.type === "fields"
      ? [
          "fields",
          normalizeHost(profile.connect_mode.host),
          profile.connect_mode.port,
          profile.connect_mode.username,
          profile.connect_mode.database,
        ]
      : ["connection_string", profile.connect_mode.value.trim().replace(/\\/g, "/")];

  const sshTunnel = profile.ssh_tunnel
    ? [
        profile.ssh_tunnel.source.type === "manual"
          ? [
              "manual",
              normalizeHost(profile.ssh_tunnel.source.host),
              profile.ssh_tunnel.source.port,
              profile.ssh_tunnel.source.user,
            ]
          : ["ssh_config", profile.ssh_tunnel.source.alias],
        normalizeHost(profile.ssh_tunnel.remote_bind_host),
        profile.ssh_tunnel.remote_bind_port,
      ]
    : null;

  return JSON.stringify([profile.db_type, connectMode, profile.password ?? "", sshTunnel]);
}

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, "");
}
