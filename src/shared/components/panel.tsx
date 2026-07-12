import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useModalStore } from "../store/modalStore";

type PanelProps = {
  panelId: string;
  title: string;
  description?: string;
  children: ReactNode | ((payload: Record<string, unknown> | undefined) => ReactNode);
};

export function Panel({ panelId, title, description, children }: PanelProps) {
  const isOpen = useModalStore((state) => state.modals.includes(panelId));
  const closePanel = useModalStore((state) => state.closeModal);
  const payload = useModalStore((state) => state.modalProps[panelId] as Record<string, unknown> | undefined);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closePanel(panelId)}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">{typeof children === "function" ? children(payload) : children}</div>
      </SheetContent>
    </Sheet>
  );
}
