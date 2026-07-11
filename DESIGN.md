---
name: Heritage
modes:
  light:
    colors:
      primary: "#1A1C1E"
      secondary: "#6C7278"
      tertiary: "#B8422E"
      neutral: "#F7F5F2"
      background: "#F7F5F2"
      surface: "#FFFFFF"
      border: "#D8D3CC"
      text: "#1A1C1E"
      textMuted: "#6C7278"
      accent: "#B8422E"
      accentHover: "#A93B2A"
    typography:
      h1:
        fontFamily: "Public Sans"
        fontSize: "3rem"
        fontWeight: 700
        lineHeight: 1.02
      body-md:
        fontFamily: "Public Sans"
        fontSize: "1rem"
        fontWeight: 400
        lineHeight: 1.6
      label-caps:
        fontFamily: "Space Grotesk"
        fontSize: "0.75rem"
        fontWeight: 600
        letterSpacing: "0.08em"
        textTransform: uppercase
    rounded:
      sm: "4px"
      md: "8px"
    spacing:
      sm: "8px"
      md: "16px"

  dark:
    colors:
      primary: "#F3F4F6"
      secondary: "#A0A7B0"
      tertiary: "#D86A56"
      neutral: "#111214"
      background: "#111214"
      surface: "#171A1D"
      elevated: "#1D2126"
      border: "#2A2F36"
      text: "#F3F4F6"
      textMuted: "#A0A7B0"
      accent: "#D86A56"
      accentHover: "#E27A65"
    typography:
      h1:
        fontFamily: "Public Sans"
        fontSize: "3rem"
        fontWeight: 700
        lineHeight: 1.02
      body-md:
        fontFamily: "Public Sans"
        fontSize: "1rem"
        fontWeight: 400
        lineHeight: 1.6
      label-caps:
        fontFamily: "Space Grotesk"
        fontSize: "0.75rem"
        fontWeight: 600
        letterSpacing: "0.08em"
        textTransform: uppercase
    rounded:
      sm: "4px"
      md: "8px"
    spacing:
      sm: "8px"
      md: "16px"
---

## Overview

Architectural minimalism meets journalistic gravitas. The UI evokes a premium matte finish, like a high-end broadsheet or a contemporary gallery.

## Colors

The palette is rooted in high-contrast neutrals and a single accent color.

### Light Mode

- **Primary (#1A1C1E):** Deep ink for headlines and core text.
- **Secondary (#6C7278):** Slate for borders, captions, and metadata.
- **Tertiary (#B8422E):** The sole interaction accent.
- **Neutral (#F7F5F2):** Warm limestone foundation, softer than pure white.
- **Surface (#FFFFFF):** Clean panel and card background.
- **Border (#D8D3CC):** Quiet divider color.
- **Text (#1A1C1E):** Main body and heading color.
- **Text Muted (#6C7278):** Secondary copy, labels, captions.

### Dark Mode

- **Background (#111214):** Deep charcoal foundation.
- **Surface (#171A1D):** Main panel surface.
- **Elevated (#1D2126):** Raised surface for dialogs and floating elements.
- **Primary (#F3F4F6):** Main text and headings.
- **Secondary (#A0A7B0):** Metadata, labels, supporting copy.
- **Tertiary (#D86A56):** Interaction accent in dark mode.
- **Border (#2A2F36):** Subtle separation between surfaces.
- **Accent Hover (#E27A65):** Hover and active state for accent actions.

## Typography

- `h1`: Public Sans, 3rem, high presence, tight leading.
- `body-md`: Public Sans, 1rem, readable and restrained.
- `label-caps`: Space Grotesk, 0.75rem, for labels and metadata.

## Shape

- Small radius for utility surfaces.
- Medium radius for cards and panels.
- No exaggerated rounding.
- Borders should feel precise, not soft or bubbly.

## Spacing

- `8px` and `16px` are the base rhythm.
- Keep vertical spacing disciplined and grid-aligned.
- Prefer clear separation over decorative padding.

## Usage Rules

- Use `primary` for text and structural contrast.
- Use `secondary` for metadata, captions, and quiet UI.
- Use `tertiary` only for actions, links, active states, and key emphasis.
- Do not introduce extra accent colors.
- Keep backgrounds neutral.
- Avoid gradients unless a specific surface genuinely needs depth.
- In dark mode, never invert colors literally; adjust by role and contrast.
- In dark mode, always define both text and background colors explicitly.
- The accent must remain the same semantic role in both modes.
