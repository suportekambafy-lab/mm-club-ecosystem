import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/lives")({
  component: () => <Outlet />,
});
