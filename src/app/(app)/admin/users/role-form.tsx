"use client";

import { useActionState } from "react";
import { ROLES, type Role } from "@/lib/roles";
import { setUserRole, type RoleFormState } from "./actions";

const initialState: RoleFormState = {};

// One row's role control. Submits to the setUserRole Server Action and shows
// its result (e.g. the last-admin error) next to the button.
export function RoleForm({ userId, role }: { userId: string; role: Role }) {
  const [state, formAction, pending] = useActionState(setUserRole, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <select
        name="role"
        defaultValue={role}
        aria-label="Role"
        className="rounded-md border border-zinc-300 px-2 py-1 text-sm capitalize"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-50 disabled:opacity-50"
      >
        {pending ? "Saving..." : "Save"}
      </button>
      {state.error && (
        <span role="alert" className="text-sm text-red-600">
          {state.error}
        </span>
      )}
      {state.success && <span className="text-sm text-green-700">{state.success}</span>}
    </form>
  );
}
