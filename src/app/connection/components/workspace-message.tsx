import type { ReactNode } from "react";

type WorkspaceMessageProps = {
  message: string;
  action?: ReactNode;
};

export function WorkspaceMessage({ message, action }: WorkspaceMessageProps) {
  return (
    <div className="flex min-h-full items-center justify-center bg-background p-8 text-center text-sm text-muted-foreground">
      <div>
        <p>{message}</p>
        {action ? <p className="mt-3 text-primary underline underline-offset-4">{action}</p> : null}
      </div>
    </div>
  );
}
