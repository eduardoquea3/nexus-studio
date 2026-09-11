---
name: Kanso
colors:
  primary: "#090E13"
  secondary: "#A4A7A4"
  tertiary: "#7FB4CA"
  neutral: "#C5C9C7"
  details: darker
typography:
  h1:
    fontFamily: Inter Variable
    fontSize: 2rem
  body-md:
    fontFamily: Inter Variable
    fontSize: 1rem
  label-caps:
    fontFamily: Space Grotesk
    fontSize: 0.75rem
rounded:
  sm: 6px
  md: 8px
spacing:
  sm: 8px
  md: 16px
terminal_colors:
  normal:
    black: "#0d0c0c"
    red: "#c4746e"
    green: "#8a9a7b"
    yellow: "#c4b28a"
    blue: "#8ba4b0"
    magenta: "#a292a3"
    cyan: "#8ea4a2"
    white: "#C8C093"
  bright:
    black: "#A4A7A4"
    red: "#E46876"
    green: "#87a987"
    yellow: "#E6C384"
    blue: "#7FB4CA"
    magenta: "#938AA9"
    cyan: "#7AA89F"
    white: "#C5C9C7"
---

## Overview

Nexus Studio is a focused tool for database developers managing saved environments.
Kanso is the default visual language: quiet technical minimalism, near-black ink,
mineral text, muted sage structure, and one restrained blue accent. The interface
should feel precise and calm during long debugging sessions, with density that
supports scanning instead of decoration.

## Theme Architecture

Themes are contracts, not component styles. `src/styles/global.css` exposes semantic
variables and maps them to Tailwind v4 with `@theme inline`. Components consume
tokens such as `bg-background`, `bg-surface`, `bg-control`, `text-foreground`,
`text-muted-foreground`, `text-primary`, `text-success`, and `border-border`.

The application currently supports the `light` and `dark` modes managed by
`src/shared/store/theme-store.ts`. The store toggles the `.dark` class on the root
element. Both modes must define the same semantic contract so changing mode does
not change component markup or behavior.

Kanso is one theme, not a permanent global assumption. A future user-defined theme
can be applied with a class or data attribute on the root element and override the
same variables:

```css
[data-theme="ocean"] {
  --background: ...;
  --surface: ...;
  --foreground: ...;
  --primary: ...;
  --success: ...;
}
```

Custom themes should keep the token names stable, define light and dark values when
needed, and avoid selector rules that target individual components. A theme may add
tokens, but existing application surfaces must continue to resolve through the
shared contract.

## Semantic Token Contract

Every UI color must resolve through a semantic variable. Do not add hex, RGB, or
arbitrary color literals to route or component class names.

| Token | Role |
|---|---|
| `background` | Workspace canvas |
| `surface` | Default cards and application surfaces |
| `surface-raised` | Hovered cards, popovers, and raised layers |
| `control` | Inset inputs and compact controls |
| `foreground` | Primary readable copy |
| `muted-foreground` | Metadata, labels, placeholders |
| `primary` | Main action, focus, and restrained brand accent |
| `border` | Quiet structural separation |
| `success`, `warning`, `destructive` | Meaningful state communication |

Surfaces progress from canvas to card to raised/control layers. Prefer border and
subtle surface shifts over dramatic shadows. Accent colors communicate action or
state; they are not decoration. All interactive controls need hover, disabled, and
keyboard-visible focus states.

## Accessibility

Themes must preserve readable contrast for body text, labels, controls, and status
indicators. Do not communicate state with color alone: pair status color with text
or an icon. Every icon-only control needs an accessible name. Search, sorting,
refresh, dialogs, and cards must remain usable with keyboard navigation. Focus rings
must remain visible against both the canvas and raised surfaces. Verify new themes
against WCAG 2.2 AA contrast expectations before shipping them.

## Typography, Shape, And Layout

- Use Inter Variable for application copy, headings, forms, and data values.
- Use Space Grotesk for compact labels, navigation metadata, and technical caps.
- Use a monospace face for hosts, ports, paths, and other technical metadata.
- Use 8px as the base spacing unit and 16px for section rhythm.
- Use 6px for compact controls and 8px for cards, panels, and grouped surfaces.
- Prefer centered max-width canvases, compact grids, thin dividers, and responsive
  3/2/1 column connection layouts.
- Keep connection cards scannable: engine mark, safe metadata, status, and edit or
  delete actions. Never expose passwords or connection-string values.
- Use semantic shadcn primitives and existing project components. Do not modify
  shared primitives to encode one theme.

## Terminal Colors

The terminal palette below is intentionally retained for query output, logs, code,
and embedded technical surfaces. It is Kanso-scoped, not a second application-wide
color contract. If a user-defined theme provides terminal colors, those values may
override this palette within terminal surfaces while the semantic UI tokens remain
the source of truth elsewhere.

### Normal

| Color | Hex |
|---|---|
| Black | `#0d0c0c` |
| Red | `#c4746e` |
| Green | `#8a9a7b` |
| Yellow | `#c4b28a` |
| Blue | `#8ba4b0` |
| Magenta | `#a292a3` |
| Cyan | `#8ea4a2` |
| White | `#C8C093` |

### Bright

| Color | Hex |
|---|---|
| Black | `#A4A7A4` |
| Red | `#E46876` |
| Green | `#87a987` |
| Yellow | `#E6C384` |
| Blue | `#7FB4CA` |
| Magenta | `#938AA9` |
| Cyan | `#7AA89F` |
| White | `#C5C9C7` |
