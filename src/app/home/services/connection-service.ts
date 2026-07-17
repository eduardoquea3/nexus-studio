import { load } from "@tauri-apps/plugin-store";

import type { ConnectionProfile } from "@/shared/types/models";

export async function getConnections(): Promise<ConnectionProfile[]> {
  const store = await load("connections.json");
  return (await store.get<ConnectionProfile[]>("profiles")) ?? [];
}

export async function getConnection(id: string): Promise<ConnectionProfile | null> {
  const profiles = await getConnections();
  return profiles.find((profile) => profile.id === id) ?? null;
}

export async function deleteConnection(id: string): Promise<void> {
  const store = await load("connections.json");
  const profiles = await getConnections();
  await store.set(
    "profiles",
    profiles.filter((profile) => profile.id !== id),
  );
  await store.save();
}
