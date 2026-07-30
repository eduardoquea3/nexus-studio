import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { EditorView } from "@codemirror/view";

export const sqlEditorTheme = [
  EditorView.theme({
      "&": {
        color: "var(--foreground)",
        backgroundColor: "var(--card)",
        height: "100%",
        width: "100%",
    },
    ".cm-content": {
      caretColor: "var(--ring)",
      padding: "1rem 0",
    },
    ".cm-line": {
      padding: "0 1rem",
      lineHeight: "1.7",
    },
    ".cm-gutters": {
      color: "var(--muted-foreground)",
      backgroundColor: "var(--card)",
      borderRight: "1px solid var(--border)",
      fontFamily: "var(--font-sans)",
      lineHeight: "1.7",
    },
    ".cm-gutterElement": {
      lineHeight: "1.7",
      padding: "0 0.75rem",
    },
    ".cm-activeLine": {
      backgroundColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
    },
    ".cm-activeLineGutter": {
      color: "var(--foreground)",
      backgroundColor: "color-mix(in srgb, var(--primary) 10%, transparent)",
    },
    ".cm-selectionBackground, .cm-content::selection, .cm-content ::selection": {
      backgroundColor: "var(--editor-selection)",
      color: "var(--editor-selection-foreground)",
    },
    ".cm-cursor": {
      borderLeftColor: "var(--ring)",
    },
    ".cm-scroller": {
      fontFamily: "var(--font-sans)",
      lineHeight: "1.7",
      scrollbarColor: "var(--border) transparent",
      scrollbarWidth: "thin",
    },
    ".cm-scroller::-webkit-scrollbar": {
      width: "0.625rem",
      height: "0.625rem",
    },
    ".cm-scroller::-webkit-scrollbar-track": {
      backgroundColor: "transparent",
    },
    ".cm-scroller::-webkit-scrollbar-thumb": {
      backgroundColor: "var(--border)",
      border: "1px solid transparent",
      borderRadius: "9999px",
      backgroundClip: "content-box",
    },
    ".cm-tooltip": {
      backgroundColor: "var(--popover)",
      color: "var(--popover-foreground)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-md)",
      boxShadow: "0 8px 24px color-mix(in srgb, var(--foreground) 12%, transparent)",
      overflow: "hidden",
    },
    ".cm-tooltip-autocomplete": {
      maxHeight: "14rem",
      padding: "0.25rem",
      scrollbarColor: "var(--border) transparent",
      scrollbarWidth: "thin",
    },
    ".cm-tooltip-autocomplete ul": {
      fontFamily: "var(--font-sans)",
      fontSize: "0.75rem",
    },
    ".cm-tooltip-autocomplete ul li": {
      borderRadius: "var(--radius-sm)",
      padding: "0.35rem 0.5rem",
      color: "var(--muted-foreground)",
    },
    ".cm-tooltip-autocomplete ul li[aria-selected]": {
      backgroundColor: "var(--editor-picker-selected)",
      color: "var(--editor-picker-selected-foreground)",
    },
    ".cm-tooltip-autocomplete ul li[aria-selected] .cm-completionMatchedText": {
      color: "var(--editor-picker-selected-foreground)",
    },
    ".cm-tooltip-autocomplete ul li[aria-selected] .cm-completionIcon": {
      color: "var(--editor-picker-selected-foreground)",
      opacity: "0.8",
    },
    ".cm-completionMatchedText": {
      color: "var(--primary)",
      fontWeight: "600",
    },
    ".cm-completionIcon": {
      color: "var(--muted-foreground)",
      opacity: "0.8",
    },
  }),
  syntaxHighlighting(
    HighlightStyle.define([
      { tag: tags.keyword, color: "var(--editor-keyword)", fontWeight: "600" },
      { tag: tags.operator, color: "var(--editor-operator)" },
      { tag: tags.string, color: "var(--editor-string)" },
      { tag: tags.number, color: "var(--editor-number)" },
      { tag: tags.comment, color: "var(--editor-comment)", fontStyle: "italic" },
      { tag: tags.variableName, color: "var(--editor-variable)" },
      { tag: tags.function(tags.variableName), color: "var(--editor-function)" },
      { tag: tags.typeName, color: "var(--editor-type)" },
    ]),
  ),
];
