import { describe, expect, test } from "bun:test";
import { extractThemeVariables } from "@/shared/lib/theme-parser";

describe("theme parser", () => {
  const css = `
    @import "tailwindcss";
    :root { --background: white; --radius: 1rem; }
    .dark { --background: black; --foreground: white; }
    @theme inline { --color-background: var(--background); }
  `;

  test("extracts only custom properties from the requested mode block", () => {
    expect(extractThemeVariables(css, "light")).toEqual({
      "--background": "white",
      "--radius": "1rem",
    });
    expect(extractThemeVariables(css, "dark")).toEqual({
      "--background": "black",
      "--foreground": "white",
    });
  });
});
