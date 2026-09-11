import type { ConnectionProfile } from "@/shared/types/models";
export function withDatabase(profile: ConnectionProfile, database: string): ConnectionProfile {
  return profile.connect_mode.type !== "fields"
    ? profile
    : { ...profile, connect_mode: { ...profile.connect_mode, database } };
}
