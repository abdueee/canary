import * as React from "react";
import { cn } from "cn";
import { fieldClasses } from "./input";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn(fieldClasses, "min-h-20 py-2", className)} {...props} />;
}

export { Textarea };
