import type { ConnectionProfile } from "@/shared/types/models";

export function getConnectionSessionKey(isOpen: boolean, editingId?: string): string | null {
  if (!isOpen) return null;
  return editingId ?? "new";
}

export function shouldResetConnectionSession(
  previousSessionKey: string | null,
  nextSessionKey: string | null,
): boolean {
  return nextSessionKey !== null && previousSessionKey !== nextSessionKey;
}

export function shouldLoadConnectionProfile(
  loadedSessionKey: string | null,
  sessionKey: string | null,
  editingId?: string,
): boolean {
  return editingId !== undefined && sessionKey === editingId && loadedSessionKey !== sessionKey;
}

export function isUnsupportedLegacyConnection(profile: ConnectionProfile): boolean {
  return profile.connect_mode.type === "connection_string" && profile.db_type !== "sqlite";
}
