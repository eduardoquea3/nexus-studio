import { Outlet, createRootRoute } from "@tanstack/react-router";
import { TitleBar } from "../shared/components/TitleBar";

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
    </div>
  );
}