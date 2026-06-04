import React from "react";
import { cn } from "@/lib/utils";

export const MobileCardList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("md:hidden space-y-3", className)} {...props} />
  ),
);
MobileCardList.displayName = "MobileCardList";

export const MobileCard = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "bg-white rounded-lg border p-4 shadow-sm hover:shadow-md transition-shadow",
        className,
      )}
      {...props}
    />
  ),
);
MobileCard.displayName = "MobileCard";

export const MobileCardRow = React.forwardRef<HTMLDivElement, { label: string; value: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>>(
  ({ className, label, value, ...props }, ref) => (
    <div ref={ref} className={cn("flex justify-between items-center py-1", className)} {...props}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  ),
);
MobileCardRow.displayName = "MobileCardRow";
