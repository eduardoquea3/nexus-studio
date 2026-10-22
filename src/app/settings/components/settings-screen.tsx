import { Combobox } from "@base-ui/react/combobox";
import {
  RiArrowLeftLine,
  RiContrast2Line,
  RiArrowDownSLine,
  RiCheckLine,
  RiFontFamily,
  RiComputerLine,
  RiCodeSSlashLine,
  RiTableLine,
  RiMoonLine,
  RiSunLine,
} from "@remixicon/react";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import type { ThemeMode, ThemeVariant } from "@/shared/types/theme";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { listSystemFonts } from "@/shared/lib/tauriApi";
import {
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  THEME_VARIANTS,
  useThemeStore,
} from "@/shared/store/theme-store";

const SETTINGS_TABS = [
  { value: "general", label: "General", icon: RiComputerLine },
  { value: "sql-editor", label: "SQL Editor", icon: RiCodeSSlashLine },
  { value: "table", label: "Table", icon: RiTableLine },
] as const;

const THEME_COLOR_KEYS = [
  "--primary",
  "--accent",
  "--background",
  "--card",
  "--destructive",
] as const;

type ThemeFamily = {
  id: string;
  name: string;
  variants: Partial<Record<ThemeMode, ThemeVariant>>;
};

const THEME_FAMILIES = Array.from(
  THEME_VARIANTS.reduce((families, variant) => {
    const familyId = variant.fileName.replace(/\.css$/, "");
    const family = families.get(familyId) ?? {
      id: familyId,
      name: familyId
        .split(/[-_]/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" "),
      variants: {},
    };
    family.variants[variant.mode] = variant;
    families.set(familyId, family);
    return families;
  }, new Map<string, ThemeFamily>()).values(),
).sort((a, b) => a.name.localeCompare(b.name));

export function SettingsScreen() {
  const router = useRouter();
  const {
    theme,
    interfaceFontFamily,
    sqlEditorFontFamily,
    resultFontFamily,
    setTheme,
    setInterfaceFontFamily,
    setSqlEditorFontFamily,
    setResultFontFamily,
    interfaceFontSize,
    sqlEditorFontSize,
    resultFontSize,
    setInterfaceFontSize,
    setSqlEditorFontSize,
    setResultFontSize,
  } = useThemeStore();
  const [systemFonts, setSystemFonts] = useState<string[]>([]);
  const [isLoadingFonts, setIsLoadingFonts] = useState(true);
  const [fontLoadError, setFontLoadError] = useState(false);

  useEffect(() => {
    let mounted = true;

    void listSystemFonts()
      .then((fonts) => {
        if (mounted) {
          setSystemFonts(fonts);
        }
      })
      .catch((error: unknown) => {
        console.error("Failed to load system fonts", error);
        if (mounted) {
          setFontLoadError(true);
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoadingFonts(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const systemFontOptions = systemFonts.map((family) => ({ value: family, family, label: family }));

  const goBack = () => {
    if (router.history.canGoBack()) {
      router.history.back();
      return;
    }
    void router.navigate({ to: "/" });
  };

  return (
    <div className="flex h-full min-h-0 bg-background text-foreground">
      <aside className="flex w-16 shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground sm:w-52">
        <div className="border-b border-border px-2 py-3 sm:px-4">
          <Button
            type="button"
            variant="ghost"
            onClick={goBack}
            aria-label="Back to app"
            className="gap-2 text-xs"
          >
            <RiArrowLeftLine aria-hidden="true" />
            <span className="hidden sm:inline">Back to app</span>
          </Button>
        </div>
        <nav aria-label="Settings sections" className="flex-1 px-2 py-5 sm:px-3">
          <p className="mb-3 hidden px-2 font-label text-[0.65rem] uppercase tracking-widest text-muted-foreground sm:block">
            Settings
          </p>
          <div
            aria-current="page"
            aria-label="Appearance"
            className="flex items-center gap-2 rounded-lg bg-sidebar-accent px-3 py-2 text-sidebar-accent-foreground"
          >
            <RiContrast2Line className="size-4 shrink-0" aria-hidden="true" />
            <div className="hidden min-w-0 sm:block">
              <h1 className="text-xs font-medium">Appearance</h1>
              <p className="mt-0.5 truncate text-[0.65rem] text-muted-foreground">
                Theme and interface
              </p>
            </div>
          </div>
        </nav>
        <p className="hidden border-t border-border px-5 py-4 text-[0.65rem] text-muted-foreground sm:block">
          Nexus Studio
        </p>
      </aside>
      <ScrollArea className="min-w-0 flex-1">
        <main className="mx-auto w-full max-w-4xl px-5 py-7 sm:px-8">
          <Tabs defaultValue="general">
            <TabsList
              aria-label="Appearance settings"
              className="mb-6 h-10 w-fit rounded-xl border border-border p-1"
            >
              {SETTINGS_TABS.map(({ value, label, icon: Icon }) => (
                <TabsTrigger key={value} value={value} className="gap-2 rounded-lg px-3 text-xs">
                  <Icon aria-hidden="true" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
            <p className="sr-only">Set the visual environment for long database sessions.</p>
            <TabsContent value="general" className="space-y-8">
              <section aria-labelledby="theme-selection-heading">
                <SectionHeading id="theme-selection-heading">Theme selection</SectionHeading>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border py-3">
                  <div>
                    <h2 className="text-xs font-medium">Theme mode</h2>
                    <p className="mt-1 text-[0.65rem] text-muted-foreground">
                      Choose a theme and its light or dark appearance.
                    </p>
                  </div>
                  <div className="flex gap-1.5" role="group" aria-label="Theme mode">
                    {(["light", "dark"] as const).map((mode) => {
                      const variant = THEME_FAMILIES.find(
                        (family) => family.variants[theme.mode]?.id === theme.id,
                      )?.variants[mode];
                      const Icon = mode === "light" ? RiSunLine : RiMoonLine;
                      return (
                        <Button
                          key={mode}
                          size="sm"
                          variant={theme.mode === mode ? "default" : "outline"}
                          disabled={!variant}
                          aria-pressed={theme.mode === mode}
                          onClick={() => {
                            if (variant) void setTheme(variant.id);
                          }}
                        >
                          <Icon data-icon="inline-start" aria-hidden="true" />
                          {mode === "light" ? "Light" : "Dark"}
                        </Button>
                      );
                    })}
                  </div>
                </div>
                <ThemeSelector
                  theme={theme}
                  families={THEME_FAMILIES}
                  onSelect={(id) => void setTheme(id)}
                />
              </section>
              <FontSetting
                title="Interface"
                defaultLabel="Theme default"
                value={interfaceFontFamily}
                options={systemFontOptions}
                isLoading={isLoadingFonts}
                onChange={(family) => void setInterfaceFontFamily(family)}
                fontSize={interfaceFontSize}
                onFontSizeChange={(size) => void setInterfaceFontSize(size)}
              />
            </TabsContent>
            <TabsContent value="sql-editor">
              <FontSetting
                title="SQL editor"
                defaultLabel="Editor default"
                value={sqlEditorFontFamily}
                options={systemFontOptions}
                isLoading={isLoadingFonts}
                onChange={(family) => void setSqlEditorFontFamily(family)}
                fontSize={sqlEditorFontSize}
                onFontSizeChange={(size) => void setSqlEditorFontSize(size)}
              />
            </TabsContent>
            <TabsContent value="table">
              <FontSetting
                title="Results"
                defaultLabel="Interface default"
                value={resultFontFamily}
                options={systemFontOptions}
                isLoading={isLoadingFonts}
                onChange={(family) => void setResultFontFamily(family)}
                fontSize={resultFontSize}
                onFontSizeChange={(size) => void setResultFontSize(size)}
              />
            </TabsContent>
          </Tabs>
          <p className="mt-4 text-[0.65rem] text-muted-foreground" role="status">
            {fontLoadError
              ? "System fonts could not be loaded. Theme defaults remain active."
              : isLoadingFonts
                ? "Loading installed fonts..."
                : `${systemFonts.length} installed ${systemFonts.length === 1 ? "font" : "fonts"} available`}
          </p>
        </main>
      </ScrollArea>
    </div>
  );
}

function SectionHeading({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="border-b border-border pb-1.5 font-label text-[0.65rem] font-medium uppercase tracking-widest text-muted-foreground"
    >
      {children}
    </h2>
  );
}

type FontOption = {
  value: string;
  family: string;
  label: string;
};

type FontSettingProps = {
  title: string;
  defaultLabel: string;
  value: string | null;
  options: FontOption[];
  isLoading: boolean;
  onChange: (fontFamily: string | null) => void;
  fontSize: number;
  onFontSizeChange: (fontSize: number) => void;
};

function FontSetting({
  title,
  defaultLabel,
  value,
  options,
  isLoading,
  onChange,
  fontSize,
  onFontSizeChange,
}: FontSettingProps) {
  const fontOptions: FontOption[] = [
    { value: `default-${title}`, family: "", label: defaultLabel },
    ...(value && !options.some((option) => option.family === value)
      ? [{ value: `saved-${value}`, family: value, label: `${value} (saved)` }]
      : []),
    ...options,
  ];
  const selectedFont =
    fontOptions.find((option) => option.family === (value ?? "")) ?? fontOptions[0];
  const [fontFilter, setFontFilter] = useState(selectedFont.label);
  const fontInputRef = useRef<HTMLInputElement>(null);
  const normalizedFontFilter = fontFilter.trim().toLowerCase();
  const filteredFontOptions = fontOptions.filter((option) =>
    option.label.toLowerCase().includes(normalizedFontFilter),
  );

  useEffect(() => {
    setFontFilter(selectedFont.label);
  }, [selectedFont.value]);

  const preferredFonts = [
    "JetBrains Mono",
    "DejaVu Sans Mono",
    "Hack",
    "Inter",
    "Open Sans",
    "Roboto",
  ];
  const quickFonts = [
    ...preferredFonts.flatMap((name) => options.filter((option) => option.family === name)),
    ...options.filter((option) => !preferredFonts.includes(option.family)),
  ].slice(0, 5);
  const cards = [fontOptions[0], ...quickFonts];

  return (
    <div className="space-y-8">
      <section aria-label={`${title} font family`}>
        <SectionHeading>Font family</SectionHeading>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((option) => {
            const selected = option.family === (value ?? "");
            return (
              <button
                key={option.value}
                type="button"
                aria-label={option.label}
                aria-pressed={selected}
                disabled={isLoading && Boolean(option.family)}
                onClick={() => onChange(option.family || null)}
                className={cn(
                  "min-w-0 rounded-xl border border-border p-3 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected && "border-primary bg-accent",
                )}
                style={option.family ? { fontFamily: option.family } : undefined}
              >
                <span className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate">{option.label}</span>
                  {selected ? (
                    <RiCheckLine className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                  ) : null}
                </span>
                <span className="mt-2 block text-[0.65rem] text-muted-foreground">
                  Aa Bb Cc 123
                </span>
              </button>
            );
          })}
        </div>
        <div
          className={cn(
            "mt-3 rounded-xl border border-border p-3",
            value &&
              !quickFonts.some((option) => option.family === value) &&
              "border-primary bg-accent",
          )}
        >
          <div className="mb-2 flex items-center gap-2 text-xs">
            <RiFontFamily className="size-3.5 text-muted-foreground" aria-hidden="true" />
            Custom font
          </div>
          <Combobox.Root
            items={fontOptions}
            value={selectedFont}
            disabled={isLoading}
            autoHighlight
            openOnInputClick
            inputValue={fontFilter}
            filteredItems={filteredFontOptions}
            itemToStringLabel={(option: FontOption | null) => option?.label ?? ""}
            onInputValueChange={setFontFilter}
            onValueChange={(option) => {
              setFontFilter(option?.label ?? "");
              onChange(option?.family || null);
            }}
          >
            <div className="relative">
              <Combobox.Input
                ref={fontInputRef}
                aria-label={`${title} font`}
                placeholder={isLoading ? "Loading fonts..." : "Search fonts"}
                className="h-10 w-full rounded-md border border-border/70 bg-background/80 px-3 pr-9 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground hover:bg-background/90 focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
                style={selectedFont.family ? { fontFamily: selectedFont.family } : undefined}
                onFocus={(event) => event.currentTarget.select()}
              />
              <Combobox.Trigger
                aria-label={`Toggle ${title} fonts`}
                className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
                onFocus={() => fontInputRef.current?.select()}
              >
                <RiArrowDownSLine aria-hidden="true" />
              </Combobox.Trigger>
            </div>
            <Combobox.Portal>
              <Combobox.Positioner align="start" sideOffset={4} className="z-50">
                <Combobox.Popup className="w-(--anchor-width) overflow-hidden rounded-lg border border-border/70 bg-popover/95 text-popover-foreground shadow-lg ring-1 ring-border/50">
                  {filteredFontOptions.length === 0 ? (
                    <Combobox.Empty className="px-3 py-6 text-center text-xs text-muted-foreground">
                      No fonts found.
                    </Combobox.Empty>
                  ) : null}
                  <Combobox.List
                    className="max-h-64 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground [&::-webkit-scrollbar-track]:bg-transparent"
                    style={{ scrollbarColor: "var(--border) transparent", scrollbarWidth: "thin" }}
                  >
                    {(option: FontOption) => (
                      <Combobox.Item
                        key={option.value}
                        value={option}
                        className="flex min-h-8 w-full cursor-default items-center gap-2 px-3 py-1.5 text-xs outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                      >
                        <span
                          className="min-w-0 flex-1 truncate"
                          style={option.family ? { fontFamily: option.family } : undefined}
                        >
                          {option.label}
                        </span>
                        <Combobox.ItemIndicator>
                          <RiCheckLine aria-hidden="true" />
                        </Combobox.ItemIndicator>
                      </Combobox.Item>
                    )}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
          <p className="mt-2 text-[0.65rem] text-muted-foreground">Search all installed fonts.</p>
        </div>
      </section>
      <section aria-label={`${title} font size`}>
        <SectionHeading>Font size</SectionHeading>
        <div className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div>
            <h3 className="text-xs font-medium">Font size</h3>
            <p className="mt-1 text-[0.65rem] text-muted-foreground">
              Adjust the {title.toLowerCase()} font size ({FONT_SIZE_MIN}–{FONT_SIZE_MAX}px).
            </p>
          </div>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={FONT_SIZE_MIN}
              max={FONT_SIZE_MAX}
              step={1}
              value={fontSize}
              aria-label={`${title} font size`}
              onChange={(event) => onFontSizeChange(Number(event.target.value))}
              className="h-4 w-36 cursor-pointer accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <output className="min-w-10 text-right text-xs tabular-nums" aria-live="polite">
              {fontSize}px
            </output>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-border p-3">
          <p className="mb-2 text-[0.65rem] text-muted-foreground">Preview</p>
          <p
            className="break-words leading-relaxed"
            style={{
              fontFamily:
                title === "SQL editor"
                  ? "var(--font-sql-editor, var(--font-sans))"
                  : title === "Results"
                    ? "var(--font-results, var(--font-sans))"
                    : "var(--font-sans)",
              fontSize: `${fontSize}px`,
            }}
          >
            {title === "SQL editor"
              ? "SELECT * FROM account WHERE active = true;"
              : title === "Results"
                ? "1    account    active    2026-01-01"
                : "Aa Bb Cc 123 — The quick brown fox jumps over the lazy dog"}
          </p>
        </div>
      </section>
    </div>
  );
}

type ThemeSelectorProps = {
  theme: ThemeVariant;
  families: ThemeFamily[];
  onSelect: (themeId: string) => void;
};

function ThemeSelector({ theme, families, onSelect }: ThemeSelectorProps) {
  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      role="group"
      aria-label="Themes"
    >
      {families.map((family) => {
        const variant =
          family.variants[theme.mode] ?? family.variants.dark ?? family.variants.light;
        if (!variant) return null;
        const selected = variant.id === theme.id;
        return (
          <button
            key={family.id}
            type="button"
            aria-label={`${family.name} theme`}
            aria-pressed={selected}
            onClick={() => onSelect(variant.id)}
            className={cn(
              "min-w-0 rounded-xl border border-border p-3 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected && "border-primary bg-accent",
            )}
          >
            <span className="flex items-center gap-2 text-[0.7rem] font-medium">
              <span
                className="size-3.5 shrink-0 rounded-full border border-border"
                style={{
                  background: `linear-gradient(135deg, ${variant.variables["--primary"] ?? "var(--primary)"} 50%, ${variant.variables["--accent"] ?? "var(--accent)"} 50%)`,
                }}
                aria-hidden="true"
              />
              <span className="truncate">{family.name}</span>
              {selected ? (
                <RiCheckLine
                  className="ml-auto size-3.5 shrink-0 text-primary"
                  aria-hidden="true"
                />
              ) : null}
            </span>
            <span className="my-3 flex gap-1" aria-hidden="true">
              {THEME_COLOR_KEYS.map((key) => (
                <span
                  key={key}
                  className="size-3 rounded-[3px] border border-foreground/5"
                  style={{ backgroundColor: variant.variables[key] ?? "transparent" }}
                />
              ))}
            </span>
            <span className="flex items-center justify-between gap-1 text-[0.6rem] text-muted-foreground">
              <span>Built-in · offline</span>
              <span>{variant.mode === "dark" ? "Dark" : "Light"}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
