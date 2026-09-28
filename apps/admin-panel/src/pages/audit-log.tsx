import { useMemo, useState } from "react";

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
import { auditLog, type AuditAction } from "@/lib/mock-data";

const actionLabel: Record<AuditAction, string> = {
  suspendUser: "suspend_user",
  createProject: "create_project",
  billingCharge: "billing_charge",
  inviteUser: "invite_user",
  deleteProject: "delete_project",
  updateRole: "update_role",
  loginFailed: "login_failed",
  createOrganization: "create_organization",
};

const dangerActions = new Set<AuditAction>(["suspendUser", "deleteProject", "loginFailed"]);
const successActions = new Set<AuditAction>(["createProject", "inviteUser", "createOrganization"]);

function actionVariant(action: AuditAction): "destructive" | "success" | "warning" {
  if (dangerActions.has(action)) return "destructive";
  if (successActions.has(action)) return "success";
  return "warning";
}

export function AuditLogPage() {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return auditLog;
    return auditLog.filter(
      (l) => l.actor.toLowerCase().includes(q) || l.target.toLowerCase().includes(q)
    );
  }, [search]);

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <PageHeader crumb="Audit Log" title="Audit Log" />

      <div className="px-4 pb-3">
        <Input
          placeholder="Search by actor or target"
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
                <TableHead>Timestamp</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((l, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs whitespace-nowrap text-text-disabled">
                    {l.time}
                  </TableCell>
                  <TableCell className="font-semibold text-text-primary">{l.actor}</TableCell>
                  <TableCell>
                    <Badge variant={actionVariant(l.action)} dot>
                      {actionLabel[l.action]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-text-secondary">{l.target}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between border-t border-border bg-background-subtle px-3 py-2 text-xs text-text-secondary">
            <span>Showing latest {filtered.length} events</span>
          </div>
        </div>
      </div>
    </div>
  );
}
