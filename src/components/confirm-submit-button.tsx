"use client";

import { Button } from "@/components/ui/button";

type Props = {
  action: () => Promise<void>;
  /** Shown in the browser's confirm dialog before the action runs. */
  confirmMessage: string;
  children: React.ReactNode;
} & Pick<React.ComponentProps<typeof Button>, "variant" | "size" | "className">;

// A form with one submit button that asks for confirmation first.
export function ConfirmSubmitButton({ action, confirmMessage, children, variant = "destructive", size, className }: Props) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      <Button type="submit" variant={variant} size={size} className={className}>
        {children}
      </Button>
    </form>
  );
}
