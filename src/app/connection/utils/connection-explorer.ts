import {
  RiFunctionLine,
  RiGitBranchLine,
  RiTableLine,
  RiEyeLine,
} from "@remixicon/react";

export const explorerGroups = [
  {
    id: "tables",
    label: "Tables",
    objectType: "table",
    emptyLabel: "No tables found",
    icon: RiTableLine,
  },
  {
    id: "views",
    label: "Views",
    objectType: "view",
    emptyLabel: "No views found",
    icon: RiEyeLine,
  },
  {
    id: "functions",
    label: "Functions",
    objectType: "function",
    emptyLabel: "No functions found",
    icon: RiFunctionLine,
  },
  {
    id: "procedures",
    label: "Procedures",
    objectType: "procedure",
    emptyLabel: "No procedures found",
    icon: RiGitBranchLine,
  },
] as const;
