import { Outlet, createRootRoute } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/toast";
import { TitleBar } from "../shared/components/title-bar";
import { GlobalKeymaps } from "../shared/keymaps/global-keymaps";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
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
