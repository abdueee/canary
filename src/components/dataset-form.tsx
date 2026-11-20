"use client";

import { useActionState } from "react";
import type { DatasetFormState } from "@/server/actions/datasets";

type Props = {
  action: (state: DatasetFormState, formData: FormData) => Promise<DatasetFormState>;
  submitLabel: string;
  defaultValues?: { name: string; description: string | null };
};

// Used for both "New dataset" and editing an existing one.
export function DatasetForm({ action, submitLabel, defaultValues }: Props) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        Name
        <input
          name="name"
          required
          maxLength={100}
          defaultValue={defaultValues?.name}
          className="border p-1"
        />
      </label>
      {state.errors?.name && <p role="alert">{state.errors.name.join(", ")}</p>}

      <label className="flex flex-col gap-1">
        Description (optional)
        <textarea
          name="description"
          maxLength={500}
          rows={3}
          defaultValue={defaultValues?.description ?? ""}
          className="border p-1"
        />
      </label>
      {state.errors?.description && <p role="alert">{state.errors.description.join(", ")}</p>}

      <button type="submit" disabled={pending} className="self-start border px-3 py-1">
        {pending ? "Saving…" : submitLabel}
      </button>
      {state.message && <p aria-live="polite">{state.message}</p>}
    </form>
  );
}
