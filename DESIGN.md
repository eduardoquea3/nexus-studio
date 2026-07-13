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

Kanso is quiet technical minimalism: a near-black workspace, mineral text,
and restrained blue accents. The interface should feel focused and deliberate,
like a database console designed for long sessions rather than decoration.

## Colors

The palette uses dark surfaces and muted natural tones. Accent color is reserved
for actions, focus, selection, and meaningful state changes.

- **Primary (#090E13):** Deep ink for the application background and dominant surfaces.
- **Secondary (#A4A7A4):** Muted sage-gray for metadata, borders, and secondary copy.
- **Tertiary (#7FB4CA):** Clear blue for primary actions, links, focus, and active states.
- **Neutral (#C5C9C7):** Soft mineral white for readable foreground text.
- **Details (darker):** Prefer layered surfaces such as `#1C1E25` and `#22262D` over bright borders.

## Component Rules

- Use semantic shadcn tokens instead of hardcoded colors in components.
- Use `bg-background` for the workspace and `bg-card` or `bg-popover` for raised surfaces.
- Use `text-foreground` for primary copy and `text-muted-foreground` for supporting copy.
- Use `bg-primary` only for intentional actions and active controls.
- Keep borders subtle; use `border-border` and avoid pure white lines.
- Keep controls at the shared project height and align labels, inputs, selects, and buttons.
- Use icons to clarify domain actions, not as decoration beside every label.

## Typography

- **Inter Variable:** Application copy, headings, forms, and data values.
- **Space Grotesk:** Compact labels, caps, navigation metadata, and technical identifiers.
- Use sentence case for controls and headings. Reserve uppercase for short metadata labels.

## Layout

- Use `8px` as the base spacing unit and `16px` for section-level rhythm.
- Use `6px` for compact control rounding and `8px` for cards, panels, and grouped surfaces.
- Prefer dense, aligned form grids over decorative whitespace.
- Keep panels visually quiet and let one accent state communicate the current action.

## Terminal Colors

Use the following terminal palette when displaying code, query output, logs, or
status indicators so embedded technical surfaces remain part of the Kanso system.

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
