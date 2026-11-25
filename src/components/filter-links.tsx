import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string; count?: number };

// A row of filter "chips" that are plain links. The selected filter lives in
// the URL (?status=open), so a filtered view can be bookmarked or shared, the
// back button works, and no client-side JavaScript is needed.
export function FilterLinks({
  label,
  param,
  options,
  current,
  pathname,
  searchParams,
  defaultValue,
}: {
  label: string;
  param: string;
  options: Option[];
  current: string;
  pathname: string;
  /** The page's other params, kept when this filter changes. */
  searchParams: Record<string, string | undefined>;
  /** Value that is left out of the URL to keep it short. */
  defaultValue: string;
}) {
  function hrefFor(value: string) {
    const params = new URLSearchParams();
    for (const [key, val] of Object.entries(searchParams)) {
      if (key !== param && val) params.set(key, val);
    }
    if (value !== defaultValue) params.set(param, value);
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-sm text-muted-foreground">{label}:</span>
      {options.map((option) => {
        const active = option.value === current;
        return (
          <Link
            key={option.value}
            href={hrefFor(option.value)}
            aria-current={active ? "page" : undefined}
            className={cn(buttonVariants({ variant: active ? "secondary" : "ghost", size: "sm" }), active && "font-semibold")}
          >
            {option.label}
            {option.count !== undefined && (
              <span className="text-muted-foreground tabular-nums">{option.count}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
