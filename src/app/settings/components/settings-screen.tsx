import { useEffect, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import {
  RiAddLine,
  RiArrowLeftLine,
  RiContrast2Line,
  RiArrowDownSLine,
  RiCheckLine,
  RiFontFamily,
  RiSubtractLine,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { listSystemFonts } from "@/shared/lib/tauriApi";
import { Combobox } from "@base-ui/react/combobox";
import {
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  THEME_VARIANTS,
  useThemeStore,
} from "@/shared/store/theme-store";
import type { ThemeMode, ThemeVariant } from "@/shared/types/theme";

const sections = [
  { label: "Appearance", description: "Theme and interface", icon: RiContrast2Line },
] as const;

const THEME_COLOR_KEYS = ["--primary", "--accent", "--background", "--card", "--destructive"] as const;

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
    <div className="relative flex h-full min-h-0 bg-background text-foreground">
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground">
        <div className="border-b border-border px-4 py-3">
          <Button
            type="button"
            variant="ghost"
            className="h-auto gap-2 px-2 py-1.5 text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground"
            onClick={goBack}
            aria-label="Back to app"
          >
            <RiArrowLeftLine aria-hidden="true" />
            <span>Back to app</span>
          </Button>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="p-4">
            <nav aria-label="Settings sections" className="space-y-1">
              <p className="mb-3 px-2 text-[0.65rem] font-medium uppercase tracking-[0.16em] text-sidebar-foreground/60">
                Configure
              </p>
              {sections.map((section, index) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.label}
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                      index === 0
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                    aria-current={index === 0 ? "page" : undefined}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-xs font-medium">{section.label}</span>
                      <span className="block truncate text-[0.65rem] text-sidebar-foreground/60">{section.description}</span>
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        </ScrollArea>
        <div className="border-t border-border p-4">
          <p className="px-2 text-[0.65rem] text-sidebar-foreground/60">Nexus Studio 0.1</p>
        </div>
      </aside>

      <ScrollArea className="min-w-0 flex-1">
        <div className="mx-auto min-h-full w-full max-w-4xl px-5 py-6 sm:px-8 sm:py-8">
          <header className="mb-8 flex items-start gap-4 border-b border-border pb-6">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2">
                <p className="font-label text-[0.65rem] font-medium uppercase tracking-[0.18em] text-primary">Control room</p>
              </div>
              <h1 className="text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">Settings</h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                Tune the workspace around the way you inspect and shape your data.
              </p>
            </div>
          </header>

          <main className="space-y-8">
            <section aria-labelledby="appearance-heading">
              <div className="mb-4">
                <h2 id="appearance-heading" className="text-base font-semibold">Appearance</h2>
                <p className="mt-1 text-sm text-muted-foreground">Set the visual environment for long database sessions.</p>
              </div>
              <div className="rounded-lg border border-border bg-card">
                <div className="border-b border-border px-4 py-4 sm:px-5">
                  <p className="text-sm font-medium">Theme</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Choose a visual system. Use the title bar toggle to switch between light and dark.
                  </p>
                </div>
                <div className="p-4 sm:p-5">
                  <ThemeSelector
                    theme={theme}
                    families={THEME_FAMILIES}
                    onSelect={(themeId) => void setTheme(themeId)}
                  />
                </div>
              </div>
              <div className="mt-3 grid gap-3 xl:grid-cols-3">
                <FontSetting
                  title="SQL editor"
                  defaultLabel="Editor default"
                  value={sqlEditorFontFamily}
                  options={systemFontOptions}
                  isLoading={isLoadingFonts}
                  onChange={(fontFamily) => void setSqlEditorFontFamily(fontFamily)}
                  fontSize={sqlEditorFontSize}
                  onFontSizeChange={(fontSize) => void setSqlEditorFontSize(fontSize)}
                />
                <FontSetting
                  title="Results"
                  defaultLabel="Interface default"
                  value={resultFontFamily}
                  options={systemFontOptions}
                  isLoading={isLoadingFonts}
                  onChange={(fontFamily) => void setResultFontFamily(fontFamily)}
                  fontSize={resultFontSize}
                  onFontSizeChange={(fontSize) => void setResultFontSize(fontSize)}
                />
                <FontSetting
                  title="Interface"
                  defaultLabel="Theme default"
                  value={interfaceFontFamily}
                  options={systemFontOptions}
                  isLoading={isLoadingFonts}
                  onChange={(fontFamily) => void setInterfaceFontFamily(fontFamily)}
                  fontSize={interfaceFontSize}
                  onFontSizeChange={(fontSize) => void setInterfaceFontSize(fontSize)}
                />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {fontLoadError
                  ? "System fonts could not be loaded. Theme defaults remain active."
                  : `${systemFonts.length} installed ${systemFonts.length === 1 ? "font" : "fonts"} available`}
              </p>
            </section>
          </main>
        </div>
      </ScrollArea>
    </div>
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
  const selectedFont = fontOptions.find((option) => option.family === (value ?? "")) ?? fontOptions[0];
  const [fontFilter, setFontFilter] = useState(selectedFont.label);
  const fontInputRef = useRef<HTMLInputElement>(null);
  const normalizedFontFilter = fontFilter.trim().toLowerCase();
  const filteredFontOptions = fontOptions.filter((option) =>
    option.label.toLowerCase().includes(normalizedFontFilter),
  );

  useEffect(() => {
    setFontFilter(selectedFont.label);
  }, [selectedFont.value]);

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-start gap-3 border-b border-border px-4 py-4">
        <RiFontFamily className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
        </div>
      </div>
      <div className="p-4">
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
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/70 pt-3">
          <span className="text-xs text-muted-foreground">Font size</span>
          <div className="flex items-center gap-1 rounded-md border border-border/70 bg-background/70 p-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              disabled={fontSize <= FONT_SIZE_MIN}
              onClick={() => onFontSizeChange(Math.max(FONT_SIZE_MIN, fontSize - 1))}
              aria-label={`Decrease ${title} font size`}
            >
              <RiSubtractLine aria-hidden="true" />
            </Button>
            <span className="min-w-12 text-center font-mono text-xs text-foreground" aria-live="polite">
              {fontSize} px
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              disabled={fontSize >= FONT_SIZE_MAX}
              onClick={() => onFontSizeChange(Math.min(FONT_SIZE_MAX, fontSize + 1))}
              aria-label={`Increase ${title} font size`}
            >
              <RiAddLine aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

type ThemeSelectorProps = {
  theme: ThemeVariant;
  families: ThemeFamily[];
  onSelect: (themeId: string) => void;
};

function ThemeSelector({ theme, families, onSelect }: ThemeSelectorProps) {
  const selectedFamily = families.find((family) => family.variants[theme.mode]?.fileName === theme.fileName) ?? families[0];
  const [filter, setFilter] = useState(selectedFamily?.name ?? "");
  const filteredFamilies = families.filter((family) => family.name.toLowerCase().includes(filter.trim().toLowerCase()));
  const activeVariant = selectedFamily?.variants[theme.mode];

  useEffect(() => {
    setFilter(selectedFamily?.name ?? "");
  }, [selectedFamily?.id]);

  return (
    <Combobox.Root
      items={families}
      value={selectedFamily}
      inputValue={filter}
      filteredItems={filteredFamilies}
      autoHighlight
      openOnInputClick
      itemToStringLabel={(family: ThemeFamily | null) => family?.name ?? ""}
      onInputValueChange={setFilter}
      onValueChange={(family) => {
        if (!family) return;
        setFilter(family.name);
        const variant = family.variants[theme.mode] ?? family.variants.dark ?? family.variants.light;
        if (variant) onSelect(variant.id);
      }}
    >
      <div className="relative">
        <ThemeSwatches variant={activeVariant} className="absolute inset-y-0 left-3" />
        <Combobox.Input
          aria-label="Theme"
          className="h-10 w-full rounded-md border border-border/70 bg-background/80 px-3 pl-24 pr-9 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground hover:bg-background/90 focus:border-ring focus:ring-2 focus:ring-ring/30"
          placeholder="Search themes"
        />
        <Combobox.Trigger
          aria-label="Toggle themes"
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          <RiArrowDownSLine aria-hidden="true" />
        </Combobox.Trigger>
      </div>
      <Combobox.Portal>
        <Combobox.Positioner align="start" sideOffset={4} className="z-50">
          <Combobox.Popup className="w-(--anchor-width) overflow-hidden rounded-lg border border-border/70 bg-popover/95 text-popover-foreground shadow-lg ring-1 ring-border/50">
            {filteredFamilies.length === 0 ? (
              <Combobox.Empty className="px-3 py-6 text-center text-xs text-muted-foreground">
                No themes found.
              </Combobox.Empty>
            ) : null}
            <Combobox.List className="max-h-64 overflow-y-auto">
              {(family: ThemeFamily) => {
                const variant = family.variants[theme.mode] ?? family.variants.dark ?? family.variants.light;
                return (
                  <Combobox.Item
                    key={family.id}
                    value={family}
                    className="flex min-h-12 w-full cursor-default items-center gap-3 px-3 py-2 text-xs outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                  >
                    <ThemeSwatches variant={variant} />
                    <span className="min-w-0 flex-1 truncate font-medium">{family.name}</span>
                    <Combobox.ItemIndicator>
                      <RiCheckLine aria-hidden="true" />
                    </Combobox.ItemIndicator>
                  </Combobox.Item>
                );
              }}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

function ThemeSwatches({ variant, className }: { variant?: ThemeVariant; className?: string }) {
  if (!variant) return null;

  return (
    <span className={cn("flex items-center -space-x-1", className)} aria-hidden="true">
      {THEME_COLOR_KEYS.map((key) => (
        <span
          key={key}
          className="size-4 rounded-full border-2 border-popover shadow-sm"
          style={{ backgroundColor: variant.variables[key] ?? "transparent" }}
        />
      ))}
    </span>
  );
}
