"use client";

import { Asterisk, Columns3, ListChecks, Percent, Plus, Ruler, Rows3, X } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { CHECK_TYPE_INFO, CHECK_TYPES, type CheckType, describeDefinition } from "@/lib/check-labels";
import {
  checkDefinitionSchema,
  DEFAULT_ROW_COUNT_LOOKBACK,
  DEFAULT_ROW_COUNT_TOLERANCE_PCT,
  INFERRED_TYPES,
  MAX_ROW_COUNT_LOOKBACK,
  type ColumnProfile,
  type InferredType,
} from "@/lib/checks/schemas";
import { formatNumber } from "@/lib/format";
import type { CheckFormState } from "@/server/actions/checks";

type Props = {
  action: (state: CheckFormState, formData: FormData) => Promise<CheckFormState>;
  /** Columns of the latest profiled version, used for pickers and hints. Empty if nothing was uploaded yet. */
  columns: ColumnProfile[];
  /** Row count of that version. */
  rowCount: number | null;
};

const TYPE_ICONS: Record<CheckType, typeof Columns3> = {
  REQUIRED_COLUMNS: Columns3,
  ROW_COUNT: Rows3,
  NULL_RATE: Percent,
  ALLOWED_VALUES: ListChecks,
  NUMERIC_RANGE: Ruler,
  UNIQUE: Asterisk,
};

type RequiredRow = { name: string; type: InferredType | ""; include: boolean };

/** "" → undefined, otherwise a number (NaN if it isn't one, which the schema rejects). */
function num(value: string): number | undefined {
  return value.trim() === "" ? undefined : Number(value);
}

function initialRequired(columns: ColumnProfile[]): RequiredRow[] {
  return columns.map((c) => ({ name: c.name, type: c.inferredType, include: true }));
}

// Builds a check with a form for each check type. The settings are turned into
// the same JSON the server action already accepts, and are validated in the
// browser with the shared schema first so mistakes show up before submitting.
export function CheckForm({ action, columns, rowCount }: Props) {
  const [type, setType] = useState<CheckType>("REQUIRED_COLUMNS");
  const [column, setColumn] = useState(columns[0]?.name ?? "");
  const [showErrors, setShowErrors] = useState(false);

  // Per-type settings. Numbers are kept as strings so fields can be empty.
  const [required, setRequired] = useState<RequiredRow[]>(() => initialRequired(columns));
  const [newColumn, setNewColumn] = useState("");
  const [rowMode, setRowMode] = useState<"relative" | "absolute">("relative");
  const [tolerancePct, setTolerancePct] = useState(String(DEFAULT_ROW_COUNT_TOLERANCE_PCT));
  const [lookback, setLookback] = useState(String(DEFAULT_ROW_COUNT_LOOKBACK));
  const [rowMin, setRowMin] = useState("");
  const [rowMax, setRowMax] = useState("");
  const [maxPct, setMaxPct] = useState("5");
  const [values, setValues] = useState<string[]>([]);
  const [caseSensitive, setCaseSensitive] = useState(true);
  const [rangeMin, setRangeMin] = useState("");
  const [rangeMax, setRangeMax] = useState("");

  const isColumnCheck = CHECK_TYPE_INFO[type].scope === "column";
  const selected = columns.find((c) => c.name === column);
  // Values seen in the latest version that aren't in the allowed list yet.
  const suggestions = (selected?.topValues ?? []).filter((v) => !values.includes(v.value));

  function resetFields() {
    setShowErrors(false);
    setRequired((rows) => rows.map((row) => ({ ...row, include: true })));
    setValues([]);
    setRangeMin("");
    setRangeMax("");
    setRowMin("");
    setRowMax("");
  }

  const [state, formAction, pending] = useActionState(async (prev: CheckFormState, formData: FormData) => {
    const result = await action(prev, formData);
    if (result.message) resetFields();
    return result;
  }, {});

  const config = useMemo(() => {
    switch (type) {
      case "REQUIRED_COLUMNS":
        return {
          columns: required
            .filter((r) => r.include)
            .map((r) => (r.type ? { name: r.name, type: r.type } : { name: r.name })),
        };
      case "ROW_COUNT":
        return rowMode === "relative"
          ? { mode: "relative", tolerancePct: num(tolerancePct), lookback: num(lookback) }
          : { mode: "absolute", min: num(rowMin), max: num(rowMax) };
      case "NULL_RATE":
        return { maxPct: num(maxPct) };
      case "ALLOWED_VALUES":
        return { values, caseSensitive };
      case "NUMERIC_RANGE":
        return { min: num(rangeMin), max: num(rangeMax) };
      case "UNIQUE":
        return {};
    }
  }, [type, required, rowMode, tolerancePct, lookback, rowMin, rowMax, maxPct, values, caseSensitive, rangeMin, rangeMax]);

  const parsed = checkDefinitionSchema.safeParse({ type, column: isColumnCheck ? column : null, config });
  const errors = parsed.success
    ? []
    : [...new Set(parsed.error.issues.map((issue) => friendlyIssue(issue.path, issue.message)))];

  function chooseType(next: CheckType) {
    setType(next);
    setShowErrors(false);
    // Start a column check on a sensible column for that type.
    if (CHECK_TYPE_INFO[next].scope === "column" && columns.length > 0) {
      const preferred =
        next === "NUMERIC_RANGE"
          ? columns.find((c) => c.inferredType === "number" || c.inferredType === "integer")
          : next === "ALLOWED_VALUES"
            ? columns.find((c) => c.topValues && c.inferredType === "string")
            : next === "NULL_RATE"
              ? columns.find((c) => c.nullPct > 0)
              : undefined;
      if (preferred) setColumn(preferred.name);
    }
  }

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!parsed.success) {
          event.preventDefault();
          setShowErrors(true);
        }
      }}
      className="flex flex-col gap-6"
    >
      {/* What the server action reads. */}
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="column" value={isColumnCheck ? column : ""} />
      <input type="hidden" name="config" value={JSON.stringify(config)} />

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-sm font-medium">1. What should be checked?</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CHECK_TYPES.map((t) => {
            const Icon = TYPE_ICONS[t];
            const info = CHECK_TYPE_INFO[t];
            const active = t === type;
            return (
              <label
                key={t}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                  active ? "border-primary bg-primary/5" : "hover:border-ring/60 hover:bg-muted/50",
                )}
              >
                <input
                  type="radio"
                  name="check-type-picker"
                  value={t}
                  checked={active}
                  onChange={() => chooseType(t)}
                  className="sr-only"
                />
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-md",
                    active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon aria-hidden className="size-4" />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{info.label}</span>
                  <span className="text-xs text-muted-foreground">{info.description}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium">2. Settings</p>

        {isColumnCheck && (
          <div className="flex max-w-md flex-col gap-2">
            <Label htmlFor="check-column">Column</Label>
            {columns.length > 0 ? (
              <NativeSelect id="check-column" value={column} onChange={(e) => setColumn(e.target.value)}>
                {columns.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.inferredType})
                  </option>
                ))}
              </NativeSelect>
            ) : (
              <Input
                id="check-column"
                value={column}
                onChange={(e) => setColumn(e.target.value)}
                placeholder="Column name"
              />
            )}
            {selected && <ColumnHint column={selected} rowCount={rowCount} />}
          </div>
        )}

        {type === "REQUIRED_COLUMNS" && (
          <RequiredColumnsFields
            fileColumns={columns}
            rows={required}
            onChange={setRequired}
            newColumn={newColumn}
            onNewColumnChange={setNewColumn}
          />
        )}

        {type === "ROW_COUNT" && (
          <div className="flex flex-col gap-4">
            <div className="grid max-w-2xl gap-2 sm:grid-cols-2">
              <ModeOption
                active={rowMode === "relative"}
                onSelect={() => setRowMode("relative")}
                title="Compared to recent versions"
                description="Catches sudden drops or spikes."
              />
              <ModeOption
                active={rowMode === "absolute"}
                onSelect={() => setRowMode("absolute")}
                title="Fixed range"
                description="Rows must stay between set numbers."
              />
            </div>
            {rowMode === "relative" ? (
              <>
                <div className="grid max-w-md gap-4 sm:grid-cols-2">
                  <NumberField
                    id="tolerance"
                    label="Allowed change"
                    suffix="%"
                    value={tolerancePct}
                    onChange={setTolerancePct}
                    min={0}
                  />
                  <NumberField
                    id="lookback"
                    label="Versions to average"
                    value={lookback}
                    onChange={setLookback}
                    min={2}
                    max={MAX_ROW_COUNT_LOOKBACK}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Skipped until the dataset has at least 2 earlier versions to compare with.
                </p>
              </>
            ) : (
              <div className="grid max-w-md gap-4 sm:grid-cols-2">
                <NumberField id="row-min" label="Minimum rows" value={rowMin} onChange={setRowMin} min={0} />
                <NumberField id="row-max" label="Maximum rows" value={rowMax} onChange={setRowMax} min={0} />
              </div>
            )}
            {rowCount !== null && (
              <p className="text-sm text-muted-foreground">The latest version has {formatNumber(rowCount)} rows.</p>
            )}
          </div>
        )}

        {type === "NULL_RATE" && (
          <div className="max-w-56">
            <NumberField
              id="max-pct"
              label="Most empty cells allowed"
              suffix="%"
              value={maxPct}
              onChange={setMaxPct}
              min={0}
              max={100}
              step="any"
            />
          </div>
        )}

        {type === "ALLOWED_VALUES" && (
          <div className="flex flex-col gap-3">
            <ChipInput values={values} onChange={setValues} />
            {suggestions.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>Seen in the latest version:</span>
                {suggestions.map((v) => (
                  <Button
                    key={v.value}
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => setValues([...values, v.value])}
                  >
                    <Plus aria-hidden />
                    {v.value}
                    <span className="text-muted-foreground">{formatNumber(v.count)}</span>
                  </Button>
                ))}
                {suggestions.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => setValues([...values, ...suggestions.map((v) => v.value)])}
                  >
                    Add all
                  </Button>
                )}
              </div>
            )}
            <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={(e) => setCaseSensitive(e.target.checked)}
                className="size-4 cursor-pointer accent-primary"
              />
              Match capitalisation exactly (so &ldquo;cad&rdquo; doesn&apos;t count as &ldquo;CAD&rdquo;)
            </label>
            <p className="text-sm text-muted-foreground">Empty cells are ignored. Use a missing values check for those.</p>
          </div>
        )}

        {type === "NUMERIC_RANGE" && (
          <div className="flex flex-col gap-2">
            <div className="grid max-w-md gap-4 sm:grid-cols-2">
              <NumberField id="range-min" label="Minimum" value={rangeMin} onChange={setRangeMin} step="any" />
              <NumberField id="range-max" label="Maximum" value={rangeMax} onChange={setRangeMax} step="any" />
            </div>
            <p className="text-sm text-muted-foreground">Leave one side empty for no limit on that side.</p>
          </div>
        )}

        {type === "UNIQUE" && (
          <p className="text-sm text-muted-foreground">No settings needed. The check fails if any value appears more than once.</p>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t pt-4">
        {parsed.success ? (
          <p className="text-sm">
            <span className="text-muted-foreground">This check: </span>
            <span className="font-medium">
              {isColumnCheck && <code className="rounded bg-muted px-1 py-0.5 text-xs">{column}</code>}{" "}
              {describeDefinition(parsed.data)}
            </span>
          </p>
        ) : (
          showErrors && (
            <ul role="alert" className="list-inside list-disc text-sm text-destructive">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending}>
            <Plus aria-hidden />
            {pending ? "Adding…" : "Add check"}
          </Button>
          {state.message && (
            <span aria-live="polite" className="text-sm text-emerald-700 dark:text-emerald-400">
              {state.message}
            </span>
          )}
        </div>
        {state.error && (
          <pre role="alert" className="text-sm whitespace-pre-wrap text-destructive">
            {state.error}
          </pre>
        )}
      </div>
    </form>
  );
}

const FIELD_LABELS: Record<string, string> = {
  column: "Column",
  columns: "Required columns",
  maxPct: "Most empty cells allowed",
  tolerancePct: "Allowed change",
  lookback: "Versions to average",
  min: "Minimum",
  max: "Maximum",
  values: "Allowed values",
};

function friendlyIssue(path: PropertyKey[], message: string): string {
  const key = [...path].reverse().find((p) => typeof p === "string" && p in FIELD_LABELS) as string | undefined;
  if (message.includes("received undefined") || message.includes("received NaN")) {
    return key ? `${FIELD_LABELS[key]}: enter a number.` : "Fill in the required fields.";
  }
  return key && !message.toLowerCase().includes(FIELD_LABELS[key].toLowerCase()) ? `${FIELD_LABELS[key]}: ${message}` : message;
}

function ColumnHint({ column, rowCount }: { column: ColumnProfile; rowCount: number | null }) {
  const parts = [
    `${column.inferredType}`,
    `${formatNumber(column.nullPct)}% empty`,
    `${formatNumber(column.distinctCount)}${column.distinctCount >= 10_000 ? "+" : ""} distinct`,
  ];
  if (column.min !== undefined && column.max !== undefined) parts.push(`range ${column.min} to ${column.max}`);
  if (rowCount !== null) parts.push(`${formatNumber(rowCount)} rows`);
  return <p className="text-sm text-muted-foreground">Latest version: {parts.join(" · ")}</p>;
}

function NumberField({
  id,
  label,
  value,
  onChange,
  suffix,
  min,
  max,
  step,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  suffix?: string;
  min?: number;
  max?: number;
  step?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(e.target.value)}
          className={suffix ? "pr-8" : undefined}
        />
        {suffix && (
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function ModeOption({
  active,
  onSelect,
  title,
  description,
}: {
  active: boolean;
  onSelect: () => void;
  title: string;
  description: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer flex-col gap-0.5 rounded-lg border p-3 transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
        active ? "border-primary bg-primary/5" : "hover:border-ring/60 hover:bg-muted/50",
      )}
    >
      <input type="radio" name="row-count-mode" checked={active} onChange={onSelect} className="sr-only" />
      <span className="text-sm font-medium">{title}</span>
      <span className="text-xs text-muted-foreground">{description}</span>
    </label>
  );
}

function RequiredColumnsFields({
  fileColumns,
  rows,
  onChange,
  newColumn,
  onNewColumnChange,
}: {
  fileColumns: ColumnProfile[];
  rows: RequiredRow[];
  onChange: (rows: RequiredRow[]) => void;
  newColumn: string;
  onNewColumnChange: (value: string) => void;
}) {
  const update = (index: number, patch: Partial<RequiredRow>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const included = rows.filter((r) => r.include).length;
  const trimmed = newColumn.trim();
  const canAdd = trimmed !== "" && !rows.some((r) => r.name === trimmed);

  // True when some of the latest file's columns are missing from the list
  // (e.g. the list was started before anything was uploaded).
  const outOfSync = fileColumns.some((c) => !rows.some((r) => r.name === c.name));

  function addColumn() {
    if (!canAdd) return;
    onChange([...rows, { name: trimmed, type: "", include: true }]);
    onNewColumnChange("");
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {included} of {rows.length} columns required. The type is checked too, unless set to &ldquo;Any type&rdquo;.
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange(rows.map((r) => ({ ...r, include: true })))}>
                Select all
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange(rows.map((r) => ({ ...r, include: false })))}>
                Clear
              </Button>
            </div>
          </div>
          <ul className="divide-y rounded-lg border">
            {rows.map((row, i) => (
              <li
                key={row.name}
                className={cn("flex flex-wrap items-center gap-3 px-3 py-2 transition-colors hover:bg-muted/40", !row.include && "opacity-60")}
              >
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={row.include}
                    onChange={(e) => update(i, { include: e.target.checked })}
                    className="size-4 cursor-pointer accent-primary"
                  />
                  <code className="truncate text-sm">{row.name}</code>
                </label>
                <NativeSelect
                  aria-label={`Type for ${row.name}`}
                  value={row.type}
                  disabled={!row.include}
                  onChange={(e) => update(i, { type: e.target.value as InferredType | "" })}
                  className="w-36"
                >
                  <option value="">Any type</option>
                  {INFERRED_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </NativeSelect>
              </li>
            ))}
          </ul>
        </>
      )}
      {outOfSync && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-3 text-sm">
          <span className="text-muted-foreground">
            The latest upload has {fileColumns.length} columns.
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() =>
              onChange([...initialRequired(fileColumns), ...rows.filter((r) => !fileColumns.some((c) => c.name === r.name))])
            }>
            Use columns from the latest upload
          </Button>
        </div>
      )}
      <div className="flex max-w-md gap-2">
        <Input
          aria-label="Add a column by name"
          placeholder={rows.length > 0 ? "Add another column by name" : "Column name"}
          value={newColumn}
          onChange={(e) => onNewColumnChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addColumn();
            }
          }}
        />
        <Button type="button" variant="outline" disabled={!canAdd} onClick={addColumn}>
          <Plus aria-hidden />
          Add
        </Button>
      </div>
    </div>
  );
}

// A list of values as removable chips. Enter or comma adds; pasting a
// comma- or line-separated list adds each item; Backspace removes the last.
function ChipInput({ values, onChange }: { values: string[]; onChange: (values: string[]) => void }) {
  const [draft, setDraft] = useState("");

  function add(items: string[]) {
    const next = [...values];
    for (const item of items.map((v) => v.trim()).filter(Boolean)) {
      if (!next.includes(item)) next.push(item);
    }
    onChange(next);
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="allowed-values">Allowed values</Label>
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-background px-2 py-1.5 transition-colors hover:border-ring/60 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
        {values.map((value) => (
          <span key={value} className="inline-flex items-center gap-1 rounded-md bg-muted py-0.5 pr-1 pl-2 text-sm">
            {value}
            <button
              type="button"
              aria-label={`Remove ${value}`}
              onClick={() => onChange(values.filter((v) => v !== value))}
              className="cursor-pointer rounded p-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
            >
              <X aria-hidden className="size-3.5" />
            </button>
          </span>
        ))}
        <input
          id="allowed-values"
          value={draft}
          placeholder={values.length === 0 ? "Type a value and press Enter" : ""}
          onChange={(e) => {
            const text = e.target.value;
            if (text.includes(",")) add(text.split(","));
            else setDraft(text);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add([draft]);
            } else if (e.key === "Backspace" && draft === "" && values.length > 0) {
              onChange(values.slice(0, -1));
            }
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (/[,\n]/.test(text)) {
              e.preventDefault();
              add(text.split(/[,\n]/));
            }
          }}
          onBlur={() => draft.trim() && add([draft])}
          className="min-w-32 flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
    </div>
  );
}
