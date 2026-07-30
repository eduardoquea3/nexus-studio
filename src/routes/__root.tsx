import { Outlet, createRootRoute } from "@tanstack/react-router";
import { Toaster } from "sonner";
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
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      <Toaster
        position="bottom-right"
        theme="system"
        expand={false}
        toastOptions={{
          unstyled: true,
          classNames: {
            toast:
              "flex w-full flex-wrap items-start gap-3 rounded-lg border border-border/80 bg-card px-4 py-3 text-card-foreground shadow-xl data-[expanded=true]:!h-[var(--front-toast-height)] data-[expanded=true]:!translate-y-0 data-[mounted=true]:animate-in data-[mounted=true]:fade-in data-[mounted=true]:slide-in-from-bottom-4 data-[mounted=true]:zoom-in-95 data-[mounted=true]:duration-300 data-[mounted=true]:ease-out data-[removed=true]:animate-out data-[removed=true]:fade-out data-[removed=true]:slide-out-to-bottom-3 data-[removed=true]:zoom-out-95 data-[removed=true]:duration-200",
            title: "text-sm font-semibold tracking-tight",
            description: "mt-1 text-xs leading-relaxed text-muted-foreground",
            content: "min-w-0 basis-full",
            actionButton:
              "ml-auto rounded-md bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90",
            cancelButton:
              "rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground",
          },
        }}
      />
    </div>
  );
}
