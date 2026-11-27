import Link from "next/link";
import { DatasetForm } from "@/components/dataset-form";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/authz";
import { createDataset } from "@/server/actions/datasets";

export default async function NewDatasetPage() {
  await requireRole("admin");

  return (
    <div className="flex flex-1 flex-col items-center justify-center py-8">
      <div className="flex w-full max-w-md flex-col gap-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">New dataset</h1>
          <p className="text-sm text-muted-foreground">One dataset per recurring CSV feed.</p>
        </div>
        <Card className="border-t-4 border-t-primary">
          <CardContent>
            <DatasetForm
              action={createDataset}
              submitLabel="Create dataset"
              secondaryAction={
                <Link href="/dashboard" className={buttonVariants({ variant: "ghost" })}>
                  Cancel
                </Link>
              }
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
