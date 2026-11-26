import * as React from "react";
import { cn } from "cn";

// Text and number inputs, styled to match the shadcn buttons and cards.
export const fieldClasses =
  "w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm shadow-xs transition-colors outline-none placeholder:text-muted-foreground hover:border-ring/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20";

function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input data-slot="input" className={cn(fieldClasses, "h-9 py-1", className)} {...props} />;
}

export { Input };
