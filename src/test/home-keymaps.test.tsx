import "./setup";

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { HomeKeymaps } from "@/app/home/keymaps/home-keymaps";
import { useModalStore } from "@/shared/store/modalStore";

const { act, cleanup, fireEvent, render } = await import("@testing-library/react");

describe("HomeKeymaps", () => {
  beforeEach(() => {
    useModalStore.setState({ modals: [], modalProps: {} });
  });

  afterEach(() => cleanup());

  test("handles Ctrl+N from Home", () => {
    const onNewConnection = mock(() => undefined);
    render(<HomeKeymaps onNewConnection={onNewConnection} isCommandBarVisible={false} />);

    fireEvent.keyDown(document, { key: "n", code: "KeyN", ctrlKey: true });
    expect(onNewConnection).toHaveBeenCalledTimes(1);

  });

  test("ignores Ctrl+N when the command bar or another modal is visible", () => {
    const onNewConnection = mock(() => undefined);
    render(<HomeKeymaps onNewConnection={onNewConnection} isCommandBarVisible />);

    fireEvent.keyDown(document, { key: "n", code: "KeyN", ctrlKey: true });
    expect(onNewConnection).not.toHaveBeenCalled();

    act(() => useModalStore.setState({ modals: ["other-modal"], modalProps: {} }));
    fireEvent.keyDown(document, { key: "n", code: "KeyN", ctrlKey: true });
    expect(onNewConnection).not.toHaveBeenCalled();
  });

  test("does not handle Ctrl+N from form controls or contenteditable elements", () => {
    const onNewConnection = mock(() => undefined);
    const { container } = render(
      <>
        <input aria-label="Connection name" />
        <div contentEditable aria-label="Editor" />
        <HomeKeymaps onNewConnection={onNewConnection} isCommandBarVisible={false} />
      </>,
    );
    const input = container.querySelector("input") as HTMLInputElement | null;
    const editor = container.querySelector("[contenteditable]") as HTMLElement | null;

    input?.focus();
    fireEvent.keyDown(input!, { key: "n", code: "KeyN", ctrlKey: true });
    editor?.focus();
    fireEvent.keyDown(editor!, { key: "n", code: "KeyN", ctrlKey: true });

    expect(onNewConnection).not.toHaveBeenCalled();
  });
});
