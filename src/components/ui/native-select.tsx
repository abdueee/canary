import { ChevronDown } from "lucide-react";
import * as React from "react";
import { cn } from "cn";
import { fieldClasses } from "./input";

// A styled native <select>: keeps the browser's own keyboard and mobile pickers.
function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className={cn("relative w-full", className)}>
      <select
        data-slot="native-select"
        className={cn(fieldClasses, "h-9 cursor-pointer appearance-none py-1 pr-9")}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

export { NativeSelect };
