import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

interface FieldProps extends HTMLAttributes<HTMLDivElement> {
  label?: string;
  htmlFor?: string;
  orientation?: "horizontal" | "vertical";
  classLabel?: string;
  children: ReactNode;
}

function Field({
  label,
  htmlFor,
  orientation = "vertical",
  classLabel,
  className,
  children,
  ...props
}: FieldProps) {
  return (
    <div
      {...props}
      className={cn(
        "flex gap-2 text-sm",
        orientation === "vertical" ? "flex-col" : "items-center justify-center gap-4",
        className,
      )}
    >
      {label ? (
        <label htmlFor={htmlFor} className={cn("w-fit leading-4", classLabel)}>
          {label}
        </label>
      ) : null}
      {children}
    </div>
  );
}

export { Field, type FieldProps };
