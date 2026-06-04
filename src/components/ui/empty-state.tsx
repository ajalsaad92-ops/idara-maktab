import { ReactNode } from "react";
import { FolderOpen } from "lucide-react";

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ icon = <FolderOpen className="h-12 w-12 text-muted-foreground/50" />, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center min-h-[200px] border-2 border-dashed border-border rounded-xl bg-surface/50">
      <div className="mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-1 mb-4">{description}</p>}
      {action && <div>{action}</div>}
    </div>
  );
}