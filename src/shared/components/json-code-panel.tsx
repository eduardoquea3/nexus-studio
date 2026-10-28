import type { CSSProperties, ReactNode } from "react";

import { json } from "@codemirror/lang-json";
import { foldGutter, foldKeymap } from "@codemirror/language";
import { keymap, lineNumbers } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";

import { sqlEditorTheme } from "@/shared/lib/sql-editor-theme";

const jsonEditorExtensions = [
  json(),
  lineNumbers(),
  foldGutter(),
  keymap.of(foldKeymap),
  ...sqlEditorTheme,
];

type JsonCodePanelProps = {
  ariaLabel: string;
  text: string;
  meta?: string;
  actions?: ReactNode;
  issues?: boolean;
  largeMessage?: string;
  fontScope?: "interface" | "results";
};

export function JsonCodePanel({
  ariaLabel,
  text,
  meta,
  actions,
  issues = false,
  largeMessage,
  fontScope = "interface",
}: JsonCodePanelProps) {
  const fontVariable = fontScope === "results" ? "var(--font-results)" : "var(--font-sans)";
  const fontSizeVariable =
    fontScope === "results" ? "var(--font-size-results)" : "var(--font-size-interface)";
  const codeStyle = {
    "--code-font-family": fontVariable,
    "--code-font-size": fontSizeVariable,
    fontFamily: fontVariable,
    fontSize: fontSizeVariable,
  } as CSSProperties;

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background"
      style={codeStyle}
    >
      {meta || actions ? (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-card/70 px-3 py-1.5 text-[0.65rem] text-muted-foreground">
          <span>{meta}</span>
          <div className="flex items-center gap-1">{actions}</div>
        </div>
      ) : null}
      <div aria-label={ariaLabel} className="min-h-0 min-w-0 flex-1 overflow-hidden bg-card/25">
        {largeMessage ? (
          <pre
            className="h-full overflow-auto whitespace-pre-wrap px-4 py-3 text-foreground"
            style={{ fontFamily: "inherit", fontSize: "inherit" }}
          >
            {text}
          </pre>
        ) : (
          <CodeMirror
            value={text}
            extensions={jsonEditorExtensions}
            height="100%"
            readOnly
            basicSetup={false}
            theme="none"
            className="h-full min-h-0 w-full [&_.cm-editor]:bg-transparent [&_.cm-scroller]:overflow-auto [&_.cm-content]:py-3"
          />
        )}
      </div>
      {issues || largeMessage ? (
        <div className="shrink-0 border-t border-border/50 px-3 py-1.5 text-[0.65rem] text-muted-foreground">
          {issues ? <span>Some values were represented loss-aware.</span> : null}
          {largeMessage ? <span>{largeMessage}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
