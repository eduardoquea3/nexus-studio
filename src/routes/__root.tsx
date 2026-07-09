import { Outlet, createRootRoute } from "@tanstack/react-router";
import "../App.css";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <>
      <Outlet />
    </>
  );
}
