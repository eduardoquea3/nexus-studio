import "./setup";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, test } from "bun:test";

import { JsonCodePanel } from "@/shared/components/json-code-panel";

const { cleanup, fireEvent, render, screen, waitFor } = await import("@testing-library/react");

const text = JSON.stringify([{ id: 1, details: { active: true } }], null, 2);

afterEach(cleanup);

describe("JSON result editor", () => {
  test("fills its container and keeps scrolling inside the editor", () => {
    render(<JsonCodePanel ariaLabel="SQL result JSON" text={text} />);

    const panel = screen.getByLabelText("SQL result JSON");
    const wrapper = panel.querySelector(".cm-theme-none");
    const editor = panel.querySelector<HTMLElement>(".cm-editor");
    expect(wrapper?.classList.contains("h-full")).toBe(true);
    expect(wrapper?.className).not.toContain("overflow-visible");
    expect(editor && getComputedStyle(editor).height).toBe("100%");
  });

  test("omits the empty header when its toolbar is supplied by the parent", () => {
    render(<JsonCodePanel ariaLabel="SQL result JSON" text={text} />);
    const panel = screen.getByLabelText("SQL result JSON");
    expect(panel.parentElement?.children.length).toBe(1);
  });

  test("folds and unfolds JSON without changing the result text", async () => {
    render(<JsonCodePanel ariaLabel="SQL result JSON" text={text} />);

    const panel = screen.getByLabelText("SQL result JSON");
    const marker = await waitFor(() => {
      const element = panel.querySelector<HTMLElement>(".cm-foldGutter [title='Fold line']");
      expect(element).not.toBeNull();
      return element!;
    });
    fireEvent.click(marker);
    expect(panel.querySelector(".cm-foldPlaceholder")).not.toBeNull();
    fireEvent.click(panel.querySelector(".cm-foldPlaceholder")!);
    expect(panel.querySelector(".cm-foldPlaceholder")).toBeNull();

    const view = EditorView.findFromDOM(panel.querySelector(".cm-editor")!)!;
    expect(view.state.doc.toString()).toBe(text);
    expect(view.state.facet(EditorState.readOnly)).toBe(true);
  });

  test("binds Results typography to settings and lets the large-result preview inherit it", () => {
    const view = render(
      <JsonCodePanel ariaLabel="Table data JSON" text={text} fontScope="results" />,
    );
    const root = screen.getByLabelText("Table data JSON").parentElement!;
    expect(root.style.getPropertyValue("--code-font-size")).toBe("var(--font-size-results)");
    expect(root.style.getPropertyValue("--code-font-family")).toBe("var(--font-results)");
    view.rerender(
      <JsonCodePanel
        ariaLabel="Table data JSON"
        text={text}
        fontScope="results"
        largeMessage="Large page"
      />,
    );
    const preview = screen.getByLabelText("Table data JSON").querySelector("pre")!;
    expect(preview.style.fontSize).toBe("inherit");
    expect(preview.style.fontFamily).toBe("inherit");
    expect(preview.className).not.toContain("text-xs");
  });

  test("preserves table result metadata, actions, and loss-aware fallback", () => {
    render(
      <JsonCodePanel
        ariaLabel="Table data JSON"
        text={text}
        meta="1 row"
        actions={<button type="button">Copy JSON</button>}
        issues
        largeMessage="Large result preview"
      />,
    );

    expect(screen.getByText("1 row")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Copy JSON" })).not.toBeNull();
    expect(screen.getByText("Some values were represented loss-aware.")).not.toBeNull();
    expect(screen.getByText("Large result preview")).not.toBeNull();
    expect(screen.getByLabelText("Table data JSON").querySelector("pre")?.textContent).toBe(text);
  });
});
