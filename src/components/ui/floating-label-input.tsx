import * as React from "react";
import { cn } from "@/lib/utils";

export interface FloatingLabelInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export const FloatingLabelInput = React.forwardRef<HTMLInputElement, FloatingLabelInputProps>(
  ({ className, label, id, ...props }, ref) => {
    return (
      <div className="relative group">
        <input
          id={id}
          ref={ref}
          placeholder=" "
          className={cn(
            "block px-3 pb-2.5 pt-4 w-full text-sm bg-transparent rounded-md border border-input appearance-none focus:outline-none focus:ring-0 focus:border-accent peer shadow-sm transition-all aria-[invalid=true]:border-destructive aria-[invalid=true]:animate-[shake_0.4s_ease-in-out]",
            className
          )}
          {...props}
        />
        <label
          htmlFor={id}
          className="absolute text-sm text-muted-foreground duration-300 transform -translate-y-4 scale-75 top-2 z-10 origin-[0] bg-surface px-2 peer-focus:px-2 peer-focus:text-accent peer-placeholder-shown:scale-100 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:top-2 peer-focus:scale-75 peer-focus:-translate-y-4 rtl:peer-focus:translate-x-1/4 rtl:peer-focus:left-auto rtl:right-2 start-1"
        >
          {label}
        </label>
      </div>
    );
  }
);

FloatingLabelInput.displayName = "FloatingLabelInput";
