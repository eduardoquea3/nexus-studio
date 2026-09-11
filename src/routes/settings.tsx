import { createFileRoute } from "@tanstack/react-router";

import { SettingsScreen } from "@/app/settings/components/settings-screen";

export const Route = createFileRoute("/settings")({ component: SettingsScreen });
