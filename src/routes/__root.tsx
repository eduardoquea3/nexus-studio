import { Outlet, createRootRoute } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { TitleBar } from "../shared/components/title-bar";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <TitleBar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      <Toaster position="bottom-right" richColors />
    </div>
  );
}
