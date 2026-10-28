import { createFileRoute } from "@tanstack/react-router";

// The root session host owns the workspace so Settings can hide it without unmounting it.
export const Route = createFileRoute("/connections/$connectionId")({ component: () => null });
