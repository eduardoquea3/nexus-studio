import { useHotkeys } from "react-hotkeys-hook";

import { useModalStore } from "@/shared/store/modalStore";

import { HomePanels } from "../lib/home-panels";

type HomeKeymapsProps = {
  onNewConnection: () => void;
  isCommandBarVisible: boolean;
};

export function HomeKeymaps({ onNewConnection, isCommandBarVisible }: HomeKeymapsProps) {
  const isAnyModalVisible = useModalStore((state) => state.modals.length > 0);
  const isNewConnectionOpen = useModalStore((state) =>
    state.modals.includes(HomePanels.NewConnection),
  );
  const isOtherModalVisible = useModalStore((state) =>
    state.modals.some((modalId) => modalId !== HomePanels.NewConnection),
  );
  const homeFocused =
    !isCommandBarVisible && !isOtherModalVisible &&
    (!isAnyModalVisible || isNewConnectionOpen);

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
