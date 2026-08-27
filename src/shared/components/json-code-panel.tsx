import { json } from "@codemirror/lang-json";
import CodeMirror from "@uiw/react-codemirror";
import type { CSSProperties, ReactNode } from "react";

import { sqlEditorTheme } from "@/shared/lib/sql-editor-theme";

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
  const fontSizeVariable = fontScope === "results" ? "var(--font-size-results)" : "var(--font-size-interface)";
  const codeStyle = {
    "--code-font-family": fontVariable,
    "--code-font-size": fontSizeVariable,
    fontFamily: fontVariable,
    fontSize: fontSizeVariable,
  } as CSSProperties;

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background" style={codeStyle}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-card/70 px-3 py-1.5 text-[0.65rem] text-muted-foreground">
        <span>{meta}</span>
        <div className="flex items-center gap-1">{actions}</div>
      </div>
      <div aria-label={ariaLabel} className="min-h-0 flex-1 overflow-auto bg-card/25">
        {largeMessage ? (
          <pre className="whitespace-pre-wrap px-4 py-3 text-xs text-foreground">{text}</pre>
        ) : (
          <CodeMirror
            value={text}
            extensions={[json(), ...sqlEditorTheme]}
            readOnly
            basicSetup={false}
            theme="none"
            className="min-h-full w-full [&_.cm-editor]:min-h-full [&_.cm-editor]:bg-transparent [&_.cm-gutters]:hidden [&_.cm-scroller]:overflow-visible [&_.cm-content]:px-4 [&_.cm-content]:py-3 [&_.cm-line]:text-xs"
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
