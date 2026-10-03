import { Button } from "@trestle/ui/components/ui/button";

export function PaginationBar({
  noun,
  page,
  pageSize,
  total,
  onPageChange,
}: {
  noun: string;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between border-t border-border bg-background-subtle px-3 py-2 text-xs text-text-secondary">
      <span>
        Showing {from}–{to} of {total} {noun}
      </span>
      <div className="flex items-center gap-2">
        <span>
          Page {page} of {pageCount}
        </span>
        <Button variant="outline" size="xs" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Prev
        </Button>
        <Button variant="outline" size="xs" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
