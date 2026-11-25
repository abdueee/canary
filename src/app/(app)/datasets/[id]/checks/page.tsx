import { Trash } from "lucide-react";
import { notFound } from "next/navigation";
import { CheckForm } from "@/components/check-form";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PageHeader } from "@/components/page-header";
import { EnabledBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/authz";
import { checkTypeLabel, describeCheck } from "@/lib/check-labels";
import { profileSchema } from "@/lib/checks/schemas";
import { db } from "@/lib/db";
import { createCheck, deleteCheck, setCheckEnabled } from "@/server/actions/checks";

// A dataset's checks. Admins add checks with a form per check type and can
// disable or delete them; viewers only see the list.
export default async function ChecksPage({ params }: PageProps<"/datasets/[id]/checks">) {
  const { id } = await params;
  const [user, dataset, latest] = await Promise.all([
    requireUser(),
    db.dataset.findUnique({
      where: { id },
      select: { id: true, name: true, checks: { orderBy: { createdAt: "asc" } } },
    }),
    // The newest version that was read successfully, for column names and hints.
    db.datasetVersion.findFirst({
      where: { datasetId: id, rowCount: { not: null } },
      orderBy: { versionNumber: "desc" },
      select: { profile: true, versionNumber: true },
    }),
  ]);

  if (!dataset) {
    notFound();
  }

  const isAdmin = user.role === "admin";
  const profile = profileSchema.safeParse(latest?.profile);
  const columns = profile.success ? profile.data.columns : [];
  const rowCount = profile.success ? profile.data.rowCount : null;
  const enabledCount = dataset.checks.filter((c) => c.enabled).length;

  return (
    <>
      <PageHeader
        crumbs={[
          { label: "Dashboard", href: "/" },
          { label: dataset.name, href: `/datasets/${dataset.id}` },
          { label: "Checks" },
        ]}
        title="Checks"
        description="Every enabled check runs on each new upload. If any check fails, the run fails and an alert is raised."
      />

      <Card>
        <CardHeader>
          <CardTitle>Current checks</CardTitle>
          <CardDescription>
            {dataset.checks.length === 0
              ? `No checks yet.${isAdmin ? " Add one below." : ""}`
              : `${enabledCount} of ${dataset.checks.length} enabled.`}
          </CardDescription>
        </CardHeader>
        {dataset.checks.length > 0 && (
          <CardContent className="flex flex-col gap-3">
            <ul className="divide-y rounded-lg border">
              {dataset.checks.map((check) => (
                <li
                  key={check.id}
                  className="flex flex-col gap-3 p-3 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className={check.enabled ? "min-w-0" : "min-w-0 opacity-60"}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{checkTypeLabel(check.type)}</span>
                      {check.column ? (
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{check.column}</code>
                      ) : (
                        <span className="text-xs text-muted-foreground">whole file</span>
                      )}
                      <EnabledBadge enabled={check.enabled} />
                    </div>
                    <p className="mt-1 text-sm break-words text-muted-foreground">{describeCheck(check)}</p>
                  </div>
                  {isAdmin && (
                    <div className="flex shrink-0 gap-2">
                      <form action={setCheckEnabled.bind(null, dataset.id, check.id, !check.enabled)}>
                        <Button type="submit" variant="outline" size="sm">
                          {check.enabled ? "Disable" : "Enable"}
                        </Button>
                      </form>
                      <ConfirmSubmitButton
                        action={deleteCheck.bind(null, dataset.id, check.id)}
                        confirmMessage="Delete this check? Its results are also removed from past runs. Disable it instead to keep them."
                        size="sm"
                      >
                        <Trash aria-hidden />
                        Delete
                      </ConfirmSubmitButton>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {isAdmin && (
              <p className="text-xs text-muted-foreground">
                Deleting a check also removes its results from past runs. Disable it to keep them.
              </p>
            )}
          </CardContent>
        )}
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Add a check</CardTitle>
            <CardDescription>
              {latest && columns.length > 0
                ? `Columns and hints come from the latest profiled upload (v${latest.versionNumber}).`
                : "Upload a version first to pick columns from a list. You can still type column names."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Keyed by version so the form picks up the new columns after each upload
                (the form keeps its state otherwise, even across navigations). */}
            <CheckForm
              key={latest?.versionNumber ?? "none"}
              action={createCheck.bind(null, dataset.id)}
              columns={columns}
              rowCount={rowCount}
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}
