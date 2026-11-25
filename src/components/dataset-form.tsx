"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { DatasetFormState } from "@/server/actions/datasets";

type Props = {
  action: (state: DatasetFormState, formData: FormData) => Promise<DatasetFormState>;
  submitLabel: string;
  defaultValues?: { name: string; description: string | null };
  /** Extra buttons next to submit, e.g. a Cancel link. */
  secondaryAction?: React.ReactNode;
};

// Used for both "New dataset" and editing an existing one.
export function DatasetForm({ action, submitLabel, defaultValues, secondaryAction }: Props) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="dataset-name">Name</Label>
        <Input
          id="dataset-name"
          name="name"
          required
          maxLength={100}
          placeholder="e.g. Daily Payments"
          defaultValue={defaultValues?.name}
          aria-invalid={state.errors?.name ? true : undefined}
        />
        {state.errors?.name && (
          <p role="alert" className="text-sm text-destructive">
            {state.errors.name.join(", ")}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="dataset-description">
          Description <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="dataset-description"
          name="description"
          maxLength={500}
          rows={3}
          placeholder="What is this file, where does it come from and who relies on it?"
          defaultValue={defaultValues?.description ?? ""}
          aria-invalid={state.errors?.description ? true : undefined}
        />
        {state.errors?.description && (
          <p role="alert" className="text-sm text-destructive">
            {state.errors.description.join(", ")}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        {secondaryAction}
        {state.message && (
          <span aria-live="polite" className="text-sm text-muted-foreground">
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
