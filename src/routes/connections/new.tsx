import { useGSAP } from "@gsap/react";
import { RiArrowLeftLine, RiDatabase2Line } from "@remixicon/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import gsap from "gsap";
import { useRef, useState } from "react";

import {
  ConnectionEnginePicker,
  type ConnectionEngine,
} from "@/app/home/components/connection-engine-picker";
import { NewConnectionPanel } from "@/app/home/components/new-connection-panel";
import { Button } from "@/components/ui/button";

gsap.registerPlugin(useGSAP);

export const Route = createFileRoute("/connections/new")({
  validateSearch: (search: Record<string, unknown>) => ({
    connectionId: typeof search.connectionId === "string" ? search.connectionId : undefined,
  }),
  component: NewConnectionRoute,
});

function NewConnectionRoute() {
  const { connectionId } = Route.useSearch();
  const navigate = useNavigate();
  const [engine, setEngine] = useState<ConnectionEngine | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const node = formRef.current;
      if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.fromTo(
        node,
        { autoAlpha: 0, y: 14, filter: "blur(5px)" },
        { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.42, ease: "power2.out" },
      );
    },
    { dependencies: [engine, connectionId], revertOnUpdate: true },
  );

  const returnToConnection = () => {
    if (connectionId) {
      void navigate({ to: "/connections/$connectionId", params: { connectionId } });
    } else {
      void navigate({ to: "/" });
    }
  };

  return (
    <div className="relative h-full overflow-auto bg-background text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-64 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage: "linear-gradient(to bottom, black, transparent)",
        }}
      />
      <div className="relative mx-auto flex min-h-full w-full max-w-6xl flex-col px-5 py-6 sm:px-8 sm:py-10">
        {connectionId ? (
          <div ref={formRef} className="min-h-[34rem] flex-1">
            <NewConnectionPanel editingId={connectionId} onCancel={returnToConnection} />
          </div>
        ) : engine === null ? (
          <div className="flex min-h-[34rem] flex-1 flex-col justify-center">
            <Button variant="ghost" className="mb-6 self-start" onClick={returnToConnection}>
              <RiArrowLeftLine data-icon="inline-start" aria-hidden="true" />
              Cancel
            </Button>
            <div className="mx-auto mb-10 flex w-full max-w-4xl items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl border border-border/70 bg-card shadow-sm">
                <RiDatabase2Line className="size-5 text-primary" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold tracking-tight">Nexus Studio</p>
                <p className="text-xs text-muted-foreground">Database connection setup</p>
              </div>
            </div>
            <ConnectionEnginePicker onSelect={setEngine} />
          </div>
        ) : (
          <div ref={formRef} className="min-h-[34rem] flex-1">
            <Button
              variant="ghost"
              className="mb-2"
              onClick={() => setEngine(null)}
              aria-label="Back to database selection"
            >
              <RiArrowLeftLine data-icon="inline-start" aria-hidden="true" />
              Choose another database
            </Button>
            <NewConnectionPanel
              initialDbType={engine}
              onCancel={() => setEngine(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
