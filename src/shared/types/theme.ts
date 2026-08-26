export type ThemeMode = "light" | "dark";

export type ThemeVariant = {
  id: string;
  name: string;
  fileName: string;
  mode: ThemeMode;
  variables: Record<string, string>;
};
