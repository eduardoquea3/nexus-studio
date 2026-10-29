import type { ConnectionProfile } from "@/shared/types/models";

export const CONNECTION_TAG_COLORS = [
  { value: "primary", label: "Primary" },
  { value: "secondary", label: "Secondary" },
  { value: "accent", label: "Accent" },
  { value: "destructive", label: "Destructive" },
  { value: "chart-1", label: "Chart 1" },
  { value: "chart-2", label: "Chart 2" },
  { value: "chart-3", label: "Chart 3" },
  { value: "chart-4", label: "Chart 4" },
  { value: "chart-5", label: "Chart 5" },
] as const;

export type ConnectionTagColor = (typeof CONNECTION_TAG_COLORS)[number]["value"];

export function getConnectionTagColor(value?: string): ConnectionTagColor {
  return CONNECTION_TAG_COLORS.find((color) => color.value === value)?.value ?? "primary";
}

export function addConnectionTag(tags: string[], value: string): string[] {
  const tag = value.trim();
  if (!tag || tags.some((existing) => existing.toLocaleLowerCase() === tag.toLocaleLowerCase())) {
    return tags;
  }
  return [...tags, tag];
}

export function getAvailableConnectionTags(profiles: ConnectionProfile[]): string[] {
  return profiles.reduce<string[]>((tags, profile) => {
    for (const tag of profile.tags ?? []) {
      if (!tags.some((existing) => existing.toLocaleLowerCase() === tag.toLocaleLowerCase())) {
        tags.push(tag);
      }
    }
    return tags;
  }, []);
}

export function matchesConnectionTag(
  profile: Pick<ConnectionProfile, "tags">,
  selectedTag: string,
): boolean {
  return (profile.tags ?? []).some(
    (tag) => tag.toLocaleLowerCase() === selectedTag.toLocaleLowerCase(),
  );
}

export function sortConnectionsByRecent<
  T extends Pick<ConnectionProfile, "id" | "name" | "last_opened_at">,
>(profiles: T[]): T[] {
  return [...profiles].sort(
    (left, right) =>
      (right.last_opened_at ?? 0) - (left.last_opened_at ?? 0) ||
      left.name.localeCompare(right.name) ||
      left.id.localeCompare(right.id),
  );
}
