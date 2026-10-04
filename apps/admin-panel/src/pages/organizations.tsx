import { useState } from "react";
import { MoreHorizontalIcon } from "lucide-react";
import type { OrgPlan, OrgStatus, Organization } from "@trestle/api-client/types";
import { useAdminOrganizations } from "@trestle/api-client/react";

import { Button } from "@trestle/ui/components/ui/button";
import { Input } from "@trestle/ui/components/ui/input";
import { Badge } from "@trestle/ui/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@trestle/ui/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@trestle/ui/components/ui/table";

import { EditOrganizationDialog } from "@/components/edit-organization-dialog";
import { NewOrganizationDialog } from "@/components/new-organization-dialog";
import { PageHeader } from "@/components/page-header";
import { PaginationBar } from "@/components/pagination-bar";
import { TableStatusRow } from "@/components/table-status-row";
import { formatDate } from "@/lib/format";
import { useDebouncedValue } from "@/lib/use-debounced-value";

const PAGE_SIZE = 8;

const statusVariant: Record<OrgStatus, "success" | "warning" | "destructive"> = {
  active: "success",
  trialing: "warning",
  pastDue: "destructive",
};

const statusLabel: Record<OrgStatus, string> = {
  active: "Active",
  trialing: "Trialing",
  pastDue: "Past due",
};

const planLabel: Record<OrgPlan, string> = {
  free: "Free",
  pro: "Pro",
  enterprise: "Enterprise",
};

export function OrganizationsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Organization | null>(null);

  const q = useDebouncedValue(search.trim());
  const orgs = useAdminOrganizations({ q: q || undefined, page, pageSize: PAGE_SIZE });
  const rows = orgs.data?.data ?? [];

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <PageHeader crumb="Organizations" title="Organizations" action={
          <NewOrganizationDialog>
            <Button size="sm">+ New organization</Button>
          </NewOrganizationDialog>
        } />

      <div className="px-4 pb-3">
        <Input
          placeholder="Search organizations"
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
                <TableHead>Organization</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableStatusRow
                colSpan={6}
                isPending={orgs.isPending}
                error={orgs.error}
                isEmpty={rows.length === 0}
                emptyLabel="No organizations match your search"
                onRetry={() => void orgs.refetch()}
              />
              {rows.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-semibold text-text-primary">{o.name}</TableCell>
                  <TableCell className="text-text-secondary">{planLabel[o.plan]}</TableCell>
                  <TableCell className="text-text-secondary">{o.memberCount}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[o.status]} dot>
                      {statusLabel[o.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-text-disabled">{formatDate(o.createdAt)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label={`Actions for ${o.name}`}
                        className="rounded-md p-1 text-text-secondary outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30"
                      >
                        <MoreHorizontalIcon className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setEditing(o)}>Edit organization</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <PaginationBar
            noun="organizations"
            page={page}
            pageSize={PAGE_SIZE}
            total={orgs.data?.meta.total ?? 0}
            onPageChange={setPage}
          />
        </div>
      </div>

      <EditOrganizationDialog organization={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
