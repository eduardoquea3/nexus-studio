import type { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useModalStore } from "../store/modalStore";

type PanelProps = {
  panelId: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  className?: string;
  children: ReactNode | ((payload: Record<string, unknown> | undefined) => ReactNode);
};

export function Panel({ panelId, title, description, icon, className, children }: PanelProps) {
  const isOpen = useModalStore((state) => state.modals.includes(panelId));
  const closePanel = useModalStore((state) => state.closeModal);
  const payload = useModalStore(
    (state) => state.modalProps[panelId] as Record<string, unknown> | undefined,
  );

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closePanel(panelId)}>
      <SheetContent side="right" showCloseButton={false}>
        <div className={cn("flex h-full flex-col", className)}>
          <SheetHeader className={icon ? "flex-row items-start gap-3" : undefined}>
            {icon ? (
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
                {icon}
              </div>
            ) : null}
            <div className={icon ? "min-w-0" : undefined}>
              <SheetTitle>{title}</SheetTitle>
              {description ? <SheetDescription>{description}</SheetDescription> : null}
            </div>
          </SheetHeader>

          <ScrollArea className="min-h-0 flex-1">
            <div className="px-6 py-5">
              {typeof children === "function" ? children(payload) : children}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
