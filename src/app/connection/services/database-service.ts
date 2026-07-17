import { listDatabases } from "@/shared/lib/tauriApi";
import type { ConnectionProfile } from "@/shared/types/models";

export async function getDatabases(profile: ConnectionProfile): Promise<string[]> {
  const initialDatabase = getInitialDatabase(profile);

  if (profile.connect_mode.type !== "fields" || !profile.password) {
    return initialDatabase ? [initialDatabase] : [];
  }

  const databases = await listDatabases({
    dbType: profile.db_type,
    host: profile.connect_mode.host,
    port: profile.connect_mode.port,
    database: initialDatabase,
    username: profile.connect_mode.username,
    password: profile.password,
  });

  return Array.from(new Set(initialDatabase ? [initialDatabase, ...databases] : databases));
}

export function getInitialDatabase(profile: ConnectionProfile): string {
  return profile.connect_mode.type === "fields" ? profile.connect_mode.database : "";
}
