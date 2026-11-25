"use client";

import { Trash } from "lucide-react";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

type Props = {
  action: () => Promise<void>;
};

// Asks for confirmation before deleting, since this removes all of the dataset's history.
export function DeleteDatasetButton({ action }: Props) {
  return (
    <ConfirmSubmitButton
      action={action}
      confirmMessage="Delete this dataset and all of its versions, runs and alerts?"
    >
      <Trash aria-hidden />
      Delete dataset
    </ConfirmSubmitButton>
  );
}
