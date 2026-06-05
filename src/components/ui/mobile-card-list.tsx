import React from "react";
import { cn } from "@/lib/utils";

export const MobileCardList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("md:hidden grid grid-cols-2 gap-2", className)} {...props} />
  ),
);
MobileCardList.displayName = "MobileCardList";

export const MobileCard = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "bg-white rounded-lg border p-2 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between text-[11px]",
        className,
      )}
      {...props}
    />
  ),
);
MobileCard.displayName = "MobileCard";

export const MobileCardRow = React.forwardRef<HTMLDivElement, { label: string; value: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>>(
  ({ className, label, value, ...props }, ref) => (
    <div ref={ref} className={cn("flex justify-between items-center py-0.5 gap-1", className)} {...props}>
      <span className="text-[10px] text-muted-foreground shrink-0">{label}</span>
      <span className="text-[10px] font-medium truncate max-w-[70%] text-end">{value}</span>
    </div>
  ),
);
MobileCardRow.displayName = "MobileCardRow";
