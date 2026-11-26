import Link from "next/link";
import { DatasetForm } from "@/components/dataset-form";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/authz";
import { createDataset } from "@/server/actions/datasets";

export default async function NewDatasetPage() {
  await requireRole("admin");

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Dashboard", href: "/" }, { label: "New dataset" }]}
        title="New dataset"
      />
      <Card className="max-w-2xl">
        <CardContent>
          <DatasetForm
            action={createDataset}
            submitLabel="Create dataset"
            secondaryAction={
              <Link href="/" className={buttonVariants({ variant: "ghost" })}>
                Cancel
              </Link>
            }
          />
        </CardContent>
      </Card>
    </>
  );
}
