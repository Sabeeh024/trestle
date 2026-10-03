import { useState } from "react";
import type { AuditAction } from "@trestle/api-client/types";
import { useAuditLog } from "@trestle/api-client/react";

import { Input } from "@trestle/ui/components/ui/input";
import { Badge } from "@trestle/ui/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@trestle/ui/components/ui/table";

import { PageHeader } from "@/components/page-header";
import { PaginationBar } from "@/components/pagination-bar";
import { TableStatusRow } from "@/components/table-status-row";
import { formatTimestamp } from "@/lib/format";
import { useDebouncedValue } from "@/lib/use-debounced-value";

const PAGE_SIZE = 10;

const dangerActions = new Set<AuditAction>(["suspend_user", "delete_user", "delete_project", "login_failed"]);
const successActions = new Set<AuditAction>(["create_project", "invite_user", "create_organization", "reinstate_user"]);

function actionVariant(action: AuditAction): "destructive" | "success" | "warning" {
  if (dangerActions.has(action)) return "destructive";
  if (successActions.has(action)) return "success";
  return "warning";
}

export function AuditLogPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const q = useDebouncedValue(search.trim());
  const log = useAuditLog({ q: q || undefined, page, pageSize: PAGE_SIZE });
  const rows = log.data?.data ?? [];

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <PageHeader crumb="Audit Log" title="Audit Log" />

      <div className="px-4 pb-3">
        <Input
          placeholder="Search by actor or target"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableStatusRow
                colSpan={4}
                isPending={log.isPending}
                error={log.error}
                isEmpty={rows.length === 0}
                emptyLabel="No events match your search"
                onRetry={() => void log.refetch()}
              />
              {rows.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-mono text-xs whitespace-nowrap text-text-disabled">
                    {formatTimestamp(entry.timestamp)}
                  </TableCell>
                  <TableCell className="font-semibold text-text-primary">{entry.actor}</TableCell>
                  <TableCell>
                    <Badge variant={actionVariant(entry.action)} dot>
                      {entry.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-text-secondary">{entry.target}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationBar
            noun="events"
            page={page}
            pageSize={PAGE_SIZE}
            total={log.data?.meta.total ?? 0}
            onPageChange={setPage}
          />
        </div>
      </div>
    </div>
  );
}
