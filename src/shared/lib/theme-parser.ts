import type { ThemeMode } from "../types/theme";

const selectorBlockPattern = /(^|[}\s])(:root|\.dark)\s*\{([^}]*)\}/g;
const variablePattern = /(--[\w-]+)\s*:\s*([^;]+);?/g;

export function extractThemeVariables(css: string, mode: ThemeMode): Record<string, string> {
  const selector = mode === "light" ? ":root" : ".dark";
  const variables: Record<string, string> = {};
  const blocks = css.matchAll(selectorBlockPattern);

  for (const match of blocks) {
    if (match[2] !== selector) {
      continue;
    }

    for (const declaration of match[3].matchAll(variablePattern)) {
      variables[declaration[1]] = declaration[2].trim();
    }
  }

  return variables;
}
