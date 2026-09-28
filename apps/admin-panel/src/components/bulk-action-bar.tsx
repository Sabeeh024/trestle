import type { ReactNode } from "react";

export function BulkActionBar({ count, children }: { count: number; children: ReactNode }) {
  if (count === 0) return null;

  return (
    <div className="mx-4 mb-3 flex items-center justify-between rounded-md border border-border-strong bg-background-muted px-3 py-2">
      <span className="text-[13px] font-semibold">{count} selected</span>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}
