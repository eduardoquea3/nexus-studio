import { Outlet, createRootRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/toast";
import { TitleBar } from "../shared/components/title-bar";
import { GlobalKeymaps } from "../shared/keymaps/global-keymaps";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  useEffect(() => {
    const preventContextMenu = (event: MouseEvent) => event.preventDefault();
    const preventBrowserZoom = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      if (["+", "=", "-", "_", "0"].includes(event.key)) event.preventDefault();
    };
    const preventWheelZoom = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) event.preventDefault();
    };
    const preventTrackpadGestureZoom = (event: Event) => event.preventDefault();

    document.addEventListener("contextmenu", preventContextMenu);
    window.addEventListener("keydown", preventBrowserZoom);
    window.addEventListener("wheel", preventWheelZoom, { capture: true, passive: false });
    window.addEventListener("gesturestart", preventTrackpadGestureZoom, { capture: true, passive: false });
    window.addEventListener("gesturechange", preventTrackpadGestureZoom, { capture: true, passive: false });

    return () => {
      document.removeEventListener("contextmenu", preventContextMenu);
      window.removeEventListener("keydown", preventBrowserZoom);
      window.removeEventListener("wheel", preventWheelZoom, true);
      window.removeEventListener("gesturestart", preventTrackpadGestureZoom, true);
      window.removeEventListener("gesturechange", preventTrackpadGestureZoom, true);
    };
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <GlobalKeymaps />
      <TitleBar />
      <main className="min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </main>
      <Toaster />
    </div>
  );
}
