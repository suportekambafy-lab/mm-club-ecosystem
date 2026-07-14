import { createFileRoute } from "@tanstack/react-router";
import DashboardPage from "./_app.index";

// Route path "/" is served by the _app layout via file-based routing when
// _app.index.tsx exists. Keeping this file as a thin alias avoids a duplicate
// index route conflict — actual UI lives in _app.index.tsx.
export const Route = createFileRoute("/")({
  component: () => null,
});

export default DashboardPage;
