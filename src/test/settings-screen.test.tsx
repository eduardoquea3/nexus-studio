import "./setup";
import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { create } from "zustand";

const navigate = mock(() => Promise.resolve());
const back = mock(() => {});
let canGoBack = false;
const listSystemFonts = mock(async () => ["JetBrains Mono", "DejaVu Sans Mono", "Inter"]);
const themes = [
  { id: "nexus-dark", name: "Nexus Dark", fileName: "nexus.css", mode: "dark", variables: {} },
  { id: "nexus-light", name: "Nexus Light", fileName: "nexus.css", mode: "light", variables: {} },
  { id: "nord-dark", name: "Nord Dark", fileName: "nord.css", mode: "dark", variables: {} },
] as const;
const setTheme = mock(async (_value: string) => {});
const setInterfaceFontFamily = mock(async (_value: string | null) => {});
const setSqlEditorFontFamily = mock(async (_value: string | null) => {});
const setResultFontFamily = mock(async (_value: string | null) => {});
const setInterfaceFontSize = mock(async (_value: number) => {});
const setSqlEditorFontSize = mock(async (_value: number) => {});
const setResultFontSize = mock(async (_value: number) => {});
const initialState = {
  theme: themes[0],
  interfaceFontFamily: null as string | null,
  sqlEditorFontFamily: "Saved Mono" as string | null,
  resultFontFamily: null as string | null,
  interfaceFontSize: 16,
  sqlEditorFontSize: 14,
  resultFontSize: 12,
  setTheme,
  setInterfaceFontFamily,
  setSqlEditorFontFamily,
  setResultFontFamily,
  setInterfaceFontSize,
  setSqlEditorFontSize,
  setResultFontSize,
};
const useThemeStore = create(() => initialState);
mock.module("@/shared/store/theme-store", () => ({
  useThemeStore,
  THEME_VARIANTS: themes,
  FONT_SIZE_MIN: 8,
  FONT_SIZE_MAX: 32,
}));
mock.module("@/shared/lib/tauriApi", () => ({ listSystemFonts }));
mock.module("@tanstack/react-router", () => ({
  useRouter: () => ({ history: { canGoBack: () => canGoBack, back }, navigate }),
}));
const { SettingsScreen } = await import("@/app/settings/components/settings-screen");
const { act, cleanup, fireEvent, render, screen, waitFor } = await import("@testing-library/react");

beforeEach(() => {
  useThemeStore.setState(initialState);
  canGoBack = false;
  listSystemFonts.mockImplementation(async () => ["JetBrains Mono", "DejaVu Sans Mono", "Inter"]);
});
afterEach(() => {
  cleanup();
  mock.clearAllMocks();
});

test("organizes appearance settings into General, SQL Editor, and Table tabs", async () => {
  render(<SettingsScreen />);
  expect(screen.getByRole("tab", { name: "General" }).getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("tab", { name: "SQL Editor" })).not.toBeNull();
  expect(screen.getByRole("tab", { name: "Table" })).not.toBeNull();
  await screen.findByRole("combobox", { name: "Interface font" });
  expect(screen.queryByRole("combobox", { name: "SQL editor font" })).toBeNull();

  fireEvent.click(screen.getByRole("tab", { name: "SQL Editor" }));
  expect(screen.getByRole("combobox", { name: "SQL editor font" })).not.toBeNull();
  expect(screen.queryByRole("combobox", { name: "Interface font" })).toBeNull();
  expect(screen.getByRole("combobox", { name: "SQL editor font" }).getAttribute("value")).toBe(
    "Saved Mono (saved)",
  );

  fireEvent.click(screen.getByRole("tab", { name: "Table" }));
  expect(screen.getByRole("combobox", { name: "Results font" })).not.toBeNull();
  expect(screen.queryByRole("combobox", { name: "SQL editor font" })).toBeNull();
});

test("shows theme cards and preserves family selection in the current mode", async () => {
  render(<SettingsScreen />);
  fireEvent.click(screen.getByRole("button", { name: "Nord theme" }));
  expect(setTheme).toHaveBeenCalledWith("nord-dark");
  fireEvent.click(screen.getByRole("button", { name: "Light" }));
  expect(setTheme).toHaveBeenCalledWith("nexus-light");
  await waitFor(() => expect(listSystemFonts).toHaveBeenCalledTimes(1));
});

test("routes font and size changes only to the active UI scope", async () => {
  render(<SettingsScreen />);
  await screen.findByRole("button", { name: "JetBrains Mono" });
  fireEvent.click(screen.getByRole("button", { name: "JetBrains Mono" }));
  expect(setInterfaceFontFamily).toHaveBeenCalledWith("JetBrains Mono");
  fireEvent.change(screen.getByRole("slider", { name: "Interface font size" }), {
    target: { value: "18" },
  });
  expect(setInterfaceFontSize).toHaveBeenCalledWith(18);

  fireEvent.click(screen.getByRole("tab", { name: "SQL Editor" }));
  fireEvent.click(screen.getByRole("button", { name: "JetBrains Mono" }));
  expect(setSqlEditorFontFamily).toHaveBeenCalledWith("JetBrains Mono");
  fireEvent.change(screen.getByRole("slider", { name: "SQL editor font size" }), {
    target: { value: "20" },
  });
  expect(setSqlEditorFontSize).toHaveBeenCalledWith(20);

  fireEvent.click(screen.getByRole("tab", { name: "Table" }));
  fireEvent.click(screen.getByRole("button", { name: "JetBrains Mono" }));
  expect(setResultFontFamily).toHaveBeenCalledWith("JetBrains Mono");
  fireEvent.change(screen.getByRole("slider", { name: "Results font size" }), {
    target: { value: "15" },
  });
  expect(setResultFontSize).toHaveBeenCalledWith(15);
  expect(setInterfaceFontFamily).toHaveBeenCalledTimes(1);
  expect(setSqlEditorFontFamily).toHaveBeenCalledTimes(1);
  expect(setResultFontFamily).toHaveBeenCalledTimes(1);
});

test("keeps font defaults usable when font discovery fails", async () => {
  listSystemFonts.mockRejectedValueOnce(new Error("Font discovery unavailable"));
  render(<SettingsScreen />);
  await screen.findByText("System fonts could not be loaded. Theme defaults remain active.");
  fireEvent.click(screen.getByRole("button", { name: "Theme default" }));
  expect(setInterfaceFontFamily).toHaveBeenCalledWith(null);
});

test("keeps installed-font search and scoped defaults available", async () => {
  render(<SettingsScreen />);
  await screen.findByRole("button", { name: "JetBrains Mono" });
  const input = screen.getByRole("combobox", { name: "Interface font" });
  fireEvent.click(screen.getByRole("button", { name: "Toggle Interface fonts" }));
  fireEvent.change(input, { target: { value: "Inter" } });
  fireEvent.click(await screen.findByRole("option", { name: "Inter" }));
  expect(setInterfaceFontFamily).toHaveBeenCalledWith("Inter");

  fireEvent.click(screen.getByRole("tab", { name: "SQL Editor" }));
  fireEvent.click(screen.getByRole("button", { name: "Editor default" }));
  expect(setSqlEditorFontFamily).toHaveBeenCalledWith(null);
  fireEvent.click(screen.getByRole("tab", { name: "Table" }));
  fireEvent.click(screen.getByRole("button", { name: "Interface default" }));
  expect(setResultFontFamily).toHaveBeenCalledWith(null);
});

test("constrains font sizes and previews the saved font size", async () => {
  render(<SettingsScreen />);
  await screen.findByRole("button", { name: "JetBrains Mono" });
  const slider = screen.getByRole("slider", { name: "Interface font size" });
  expect(slider.getAttribute("min")).toBe("8");
  expect(slider.getAttribute("max")).toBe("32");
  act(() => useThemeStore.setState({ interfaceFontSize: 18 }));
  expect(screen.getByText(/Aa Bb Cc 123 — The quick/).getAttribute("style")).toContain(
    "font-size: 18px",
  );
});

test("keeps back navigation working with and without history", async () => {
  const view = render(<SettingsScreen />);
  fireEvent.click(screen.getByRole("button", { name: "Back to app" }));
  expect(navigate).toHaveBeenCalledWith({ to: "/" });
  canGoBack = true;
  view.rerender(<SettingsScreen />);
  fireEvent.click(screen.getByRole("button", { name: "Back to app" }));
  expect(back).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(listSystemFonts).toHaveBeenCalledTimes(1));
});
