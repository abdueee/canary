"use client";

import { useActionState, useState } from "react";
import type { CheckFormState } from "@/server/actions/checks";

type Props = {
  action: (state: CheckFormState, formData: FormData) => Promise<CheckFormState>;
  /** Columns of the latest version, to suggest column names and prefill examples. */
  columns: { name: string; type: string }[];
};

const TYPES = ["REQUIRED_COLUMNS", "ROW_COUNT", "NULL_RATE", "ALLOWED_VALUES", "NUMERIC_RANGE", "UNIQUE"] as const;
type Type = (typeof TYPES)[number];

const TABLE_TYPES: Type[] = ["REQUIRED_COLUMNS", "ROW_COUNT"];

function exampleSettings(type: Type, columns: Props["columns"]): string {
  const examples: Record<Type, unknown> = {
    REQUIRED_COLUMNS: {
      columns: columns.length > 0 ? columns : [{ name: "claim_id", type: "integer" }, { name: "status" }],
    },
    ROW_COUNT: { mode: "relative", tolerancePct: 20, lookback: 5 },
    NULL_RATE: { maxPct: 5 },
    ALLOWED_VALUES: { values: ["approved", "pending", "denied"], caseSensitive: false },
    NUMERIC_RANGE: { min: 0, max: 10000 },
    UNIQUE: {},
  };
  return JSON.stringify(examples[type], null, 2);
}

// Barebones check builder: pick a type, a column and type the settings as JSON.
// Feature 10 replaces this with a proper form per check type.
export function CheckForm({ action, columns }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  const [type, setType] = useState<Type>("REQUIRED_COLUMNS");
  const [settings, setSettings] = useState(() => exampleSettings("REQUIRED_COLUMNS", columns));
  const needsColumn = !TABLE_TYPES.includes(type);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        Type
        <select
          name="type"
          value={type}
          onChange={(event) => {
            const next = event.target.value as Type;
            setType(next);
            setSettings(exampleSettings(next, columns));
          }}
          className="border p-1"
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      {needsColumn && (
        <label className="flex flex-col gap-1">
          Column
          <input name="column" list="check-columns" required className="border p-1" />
          <datalist id="check-columns">
            {columns.map((c) => (
              <option key={c.name} value={c.name} />
            ))}
          </datalist>
        </label>
      )}

      <label className="flex flex-col gap-1">
        Settings (JSON)
        <textarea
          name="config"
          rows={8}
          value={settings}
          onChange={(event) => setSettings(event.target.value)}
          className="border p-1 font-mono text-sm"
        />
      </label>
      {type === "ROW_COUNT" && (
        <p className="text-sm">Or a fixed range: {`{ "mode": "absolute", "min": 100, "max": 5000 }`}</p>
      )}

      <button type="submit" disabled={pending} className="self-start border px-3 py-1">
        {pending ? "Adding…" : "Add check"}
      </button>
      {state.error && (
        <pre role="alert" className="whitespace-pre-wrap">
          {state.error}
        </pre>
      )}
      {state.message && <p aria-live="polite">{state.message}</p>}
    </form>
  );
}
