import { useMemo, useState } from "react";

import { Button } from "@trestle/ui/components/ui/button";
import { Input } from "@trestle/ui/components/ui/input";
import { Badge } from "@trestle/ui/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@trestle/ui/components/ui/table";

import { PageHeader } from "@/components/page-header";
import { organizations, type OrgPlan, type OrgStatus } from "@/lib/mock-data";

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return organizations;
    return organizations.filter((o) => o.name.toLowerCase().includes(q));
  }, [search]);

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        crumb="Organizations"
        title="Organizations"
        action={<Button size="sm">+ New organization</Button>}
      />

      <div className="px-4 pb-3">
        <Input
          placeholder="Search organizations"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-semibold text-text-primary">{o.name}</TableCell>
                  <TableCell className="text-text-secondary">{planLabel[o.plan]}</TableCell>
                  <TableCell className="text-text-secondary">{o.members}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[o.status]} dot>
                      {statusLabel[o.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-text-disabled">{o.created}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between border-t border-border bg-background-subtle px-3 py-2 text-xs text-text-secondary">
            <span>
              Showing 1–{filtered.length} of {organizations.length} organizations
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
