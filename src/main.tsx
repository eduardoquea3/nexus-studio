import { createRouter, RouterProvider } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { routeTree } from "./routeTree.gen";
import { getConnections } from "./app/home/services/connection-service";
import { initWorkspacePersistence } from "./shared/store/workspace-persistence";
import { listSchemaObjects } from "./shared/lib/tauriApi";
import { useWorkspaceStore } from "./shared/store/workspace-store";
import { initThemeStore } from "./shared/store/theme-store";
import "./styles/global.css";

const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  scrollRestoration: true,
});

const queryClient = new QueryClient();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

async function initWorkspaceStore() {
  try {
    const profiles = await getConnections();
    const persist = await initWorkspacePersistence(
      () => {
        const state = useWorkspaceStore.getState();
        return { activeConnectionId: state.activeConnectionId, connections: state.connections };
      },
      (snapshot) => useWorkspaceStore.getState().hydrate(snapshot),
      new Set(profiles.map((profile) => profile.id)),
      async (connectionId, database) => {
        const profile = profiles.find((candidate) => candidate.id === connectionId);
        if (!profile) {
          throw new Error(`Connection ${connectionId} is no longer available.`);
        }
        return listSchemaObjects(profile, database);
      },
    );

    useWorkspaceStore.subscribe((state, previousState) => {
      if (state.isHydrated && state !== previousState) {
        persist();
      }
    });
  } catch (error: unknown) {
    console.error("Failed to initialize workspace store", error);
    useWorkspaceStore.setState({ isHydrated: true });
  }
}

async function bootstrap() {
  await Promise.allSettled([initThemeStore(), initWorkspaceStore()]);

  const rootElement = document.getElementById("root");
  if (!rootElement || rootElement.innerHTML) {
    return;
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </React.StrictMode>,
  );
}

void bootstrap();
