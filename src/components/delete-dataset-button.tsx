"use client";

type Props = {
  action: () => Promise<void>;
};

// Asks for confirmation before deleting, since this removes all of the dataset's history.
export function DeleteDatasetButton({ action }: Props) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!confirm("Delete this dataset and all of its versions, runs and alerts?")) {
          event.preventDefault();
        }
      }}
    >
      <button type="submit" className="border px-3 py-1">
        Delete dataset
      </button>
    </form>
  );
}
