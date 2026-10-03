import { Button } from "@trestle/ui/components/ui/button";
import { TableCell, TableRow } from "@trestle/ui/components/ui/table";

// Renders the loading, error and empty states of a table body; renders nothing once there are rows.
export function TableStatusRow({
  colSpan,
  isPending,
  error,
  isEmpty,
  emptyLabel,
  onRetry,
}: {
  colSpan: number;
  isPending: boolean;
  error: Error | null;
  isEmpty: boolean;
  emptyLabel: string;
  onRetry: () => void;
}) {
  if (isPending) {
    return (
      <TableRow>
        <TableCell colSpan={colSpan} className="py-8 text-center text-text-secondary">
          Loading…
        </TableCell>
      </TableRow>
    );
  }

  if (error) {
    return (
      <TableRow>
        <TableCell colSpan={colSpan} className="py-8 text-center">
          <p role="alert" className="mb-2 text-feedback-danger">
            {error.message}
          </p>
          <Button variant="outline" size="xs" onClick={onRetry}>
            Retry
          </Button>
        </TableCell>
      </TableRow>
    );
  }

  if (isEmpty) {
    return (
      <TableRow>
        <TableCell colSpan={colSpan} className="py-8 text-center text-text-secondary">
          {emptyLabel}
        </TableCell>
      </TableRow>
    );
  }

  return null;
}
