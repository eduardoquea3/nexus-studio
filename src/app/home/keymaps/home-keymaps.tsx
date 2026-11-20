import { useHotkeys } from "react-hotkeys-hook";

import { getShortcutBinding } from "@/shared/keymaps/shortcut-catalog";
import { useModalStore } from "@/shared/store/modalStore";
import { useShortcutStore } from "@/shared/store/shortcut-store";

type HomeKeymapsProps = {
  onNewConnection: () => void;
  isCommandBarVisible: boolean;
};

export function HomeKeymaps({ onNewConnection, isCommandBarVisible }: HomeKeymapsProps) {
  const isAnyModalVisible = useModalStore((state) => state.modals.length > 0);
  const homeFocused = !isCommandBarVisible && !isAnyModalVisible;
  const overrides = useShortcutStore((state) => state.overrides);
  const newConnectionBinding = getShortcutBinding("new-connection", overrides);

  useHotkeys(
    newConnectionBinding ?? "ctrl+n",
    (event) => {
      event.preventDefault();
      onNewConnection();
    },
    {
      enabled: homeFocused && newConnectionBinding !== null,
      enableOnContentEditable: false,
      enableOnFormTags: false,
      preventDefault: true,
    },
    [homeFocused, newConnectionBinding, onNewConnection],
  );

  return null;
}
