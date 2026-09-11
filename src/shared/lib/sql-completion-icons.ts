import type { LucideIcon } from "lucide-react";

import { autocompletion, type Completion } from "@codemirror/autocomplete";
import {
  Box,
  Braces,
  CircleDot,
  Code2,
  Columns3,
  FunctionSquare,
  Table2,
  Text,
  Type,
  Variable,
} from "lucide-react";
import { createElement } from "react";
import { createRoot } from "react-dom/client";

const completionIconComponents: Record<string, LucideIcon> = {
  table: Table2,
  field: Columns3,
  property: Columns3,
  keyword: Code2,
  variable: Variable,
  constant: CircleDot,
  type: Type,
  function: FunctionSquare,
  method: FunctionSquare,
  namespace: Braces,
  class: Box,
  interface: Braces,
  text: Text,
};

const completionIconComponentsByType = new Map(Object.entries(completionIconComponents));

function completionIconType(completion: Completion): string | undefined {
  return completion.type?.split(/\s+/).find((type) => completionIconComponentsByType.has(type));
}

export const sqlCompletionIcons = autocompletion({
  icons: false,
  addToOptions: [
    {
      position: 20,
      render(completion) {
        const type = completionIconType(completion);
        const Icon = type ? completionIconComponentsByType.get(type) : undefined;
        if (!Icon) {
          return null;
        }

        const icon = document.createElement("span");
        icon.className = `cm-sqlCompletionIcon cm-sqlCompletionIcon-${type}`;
        icon.setAttribute("aria-hidden", "true");
        createRoot(icon).render(
          createElement(Icon, {
            size: 15,
            strokeWidth: 1.8,
            "aria-hidden": true,
            focusable: false,
          }),
        );
        return icon;
      },
    },
  ],
});
