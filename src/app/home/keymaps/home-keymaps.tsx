import { useHotkeys } from "react-hotkeys-hook";

import { useModalStore } from "@/shared/store/modalStore";

type HomeKeymapsProps = {
  onNewConnection: () => void;
  isCommandBarVisible: boolean;
};

export function HomeKeymaps({ onNewConnection, isCommandBarVisible }: HomeKeymapsProps) {
  const isAnyModalVisible = useModalStore((state) => state.modals.length > 0);
  const homeFocused = !isCommandBarVisible && !isAnyModalVisible;

  useHotkeys(
    "ctrl+n",
    (event) => {
      event.preventDefault();
      onNewConnection();
    },
    {
      enabled: homeFocused,
      enableOnContentEditable: false,
      enableOnFormTags: false,
      preventDefault: true,
    },
    [homeFocused, onNewConnection],
  );

  return null;
}
