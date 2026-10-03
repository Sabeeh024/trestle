import { useState } from "react";
import type { UserStatus } from "@trestle/api-client/types";
import {
  useAdminUser,
  useAdminUsers,
  useBulkUserAction,
  useDeleteUser,
  useReinstateUser,
  useResetUserPassword,
  useSuspendUser,
} from "@trestle/api-client/react";

import { Button } from "@trestle/ui/components/ui/button";
import { Input } from "@trestle/ui/components/ui/input";
import { Badge } from "@trestle/ui/components/ui/badge";
import { Checkbox } from "@trestle/ui/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@trestle/ui/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@trestle/ui/components/ui/table";
import { SidePanel, SidePanelBody, SidePanelHeader } from "@trestle/ui/components/side-panel";
import { PropertyList, PropertyItem } from "@trestle/ui/components/property-list";

import { BulkActionBar } from "@/components/bulk-action-bar";
import { ConfirmDialog, type Confirmation } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { PaginationBar } from "@/components/pagination-bar";
import { TableStatusRow } from "@/components/table-status-row";
import { formatDate, formatRelative } from "@/lib/format";
import { useDebouncedValue } from "@/lib/use-debounced-value";

const PAGE_SIZE = 8;

const statusVariant: Record<UserStatus, "success" | "warning" | "destructive"> = {
  active: "success",
  invited: "warning",
  suspended: "destructive",
};

export function UsersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [passwordResetSent, setPasswordResetSent] = useState(false);

  const q = useDebouncedValue(search.trim());
  const users = useAdminUsers({ q: q || undefined, page, pageSize: PAGE_SIZE, sort: "name" });
  const detail = useAdminUser(detailId);

  const suspend = useSuspendUser();
  const reinstate = useReinstateUser();
  const remove = useDeleteUser();
  const resetPassword = useResetUserPassword();
  const bulk = useBulkUserAction();

  const rows = users.data?.data ?? [];
  const total = users.data?.meta.total ?? 0;
  const allSelected = rows.length > 0 && rows.every((u) => selected.includes(u.id));

  async function run(action: () => Promise<unknown>) {
    setActionError(null);
    try {
      await action();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Something went wrong");
    }
  }

  const goToPage = (next: number) => {
    setPage(next);
    setSelected([]);
  };

  const toggleAll = () => setSelected(allSelected ? [] : rows.map((u) => u.id));
  const toggleOne = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const openDetail = (id: string) => {
    setDetailId(id);
    setPasswordResetSent(false);
  };

  const confirmBulk = (action: "suspend" | "delete") =>
    setConfirmation({
      title: `${action === "suspend" ? "Suspend" : "Delete"} ${selected.length} ${selected.length === 1 ? "user" : "users"}?`,
      description:
        action === "suspend"
          ? "They will immediately lose access to all workspaces. They can be reinstated later."
          : "This permanently removes the selected users and cannot be undone.",
      confirmLabel: action === "suspend" ? "Suspend" : "Delete",
      onConfirm: () =>
        void run(async () => {
          await bulk.mutateAsync({ action, ids: selected });
          setSelected([]);
        }),
    });

  const user = detail.data;

  return (
    <div className="flex min-w-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <PageHeader crumb="Users" title="Users" action={<Button size="sm">+ Invite user</Button>} />

        <div className="px-4 pb-3">
          <Input
            placeholder="Search by name or email"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              goToPage(1);
            }}
            className="max-w-xs"
          />
        </div>

        {actionError ? (
          <p role="alert" className="mx-4 mb-3 rounded-md bg-feedback-dangerBg px-3 py-2 text-[13px] text-feedback-danger">
            {actionError}
          </p>
        ) : null}

        <BulkActionBar count={selected.length}>
          <Button variant="outline" size="sm" onClick={() => confirmBulk("suspend")}>
            Suspend
          </Button>
          <Button variant="destructive" size="sm" onClick={() => confirmBulk("delete")}>
            Delete
          </Button>
        </BulkActionBar>

        <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all users" />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableStatusRow
                  colSpan={7}
                  isPending={users.isPending}
                  error={users.error}
                  isEmpty={rows.length === 0}
                  emptyLabel="No users match your search"
                  onRetry={() => void users.refetch()}
                />
                {rows.map((u) => (
                  <TableRow
                    key={u.id}
                    className="cursor-pointer"
                    data-state={selected.includes(u.id) ? "selected" : undefined}
                    onClick={() => openDetail(u.id)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.includes(u.id)}
                        onCheckedChange={() => toggleOne(u.id)}
                        aria-label={`Select ${u.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar size="sm">
                          <AvatarFallback>{u.initials}</AvatarFallback>
                        </Avatar>
                        <span className="font-semibold text-text-primary">{u.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-text-secondary">{u.email}</TableCell>
                    <TableCell className="text-text-secondary">{u.orgName}</TableCell>
                    <TableCell className="text-text-secondary capitalize">{u.role}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[u.status]} dot className="capitalize">
                        {u.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-text-disabled">{formatDate(u.joinedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginationBar noun="users" page={page} pageSize={PAGE_SIZE} total={total} onPageChange={goToPage} />
          </div>
        </div>
      </div>

      {detailId ? (
        <SidePanel>
          <SidePanelHeader onClose={() => setDetailId(null)}>User detail</SidePanelHeader>
          <SidePanelBody className="gap-4">
            {detail.isPending ? <p className="text-text-secondary">Loading…</p> : null}
            {detail.error ? (
              <p role="alert" className="text-feedback-danger">
                {detail.error.message}
              </p>
            ) : null}
            {user ? (
              <>
                <div className="flex items-center gap-3">
                  <Avatar size="lg">
                    <AvatarFallback>{user.initials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-[15px] font-bold">{user.name}</p>
                    <p className="text-xs text-text-secondary">{user.email}</p>
                  </div>
                </div>

                <PropertyList>
                  <PropertyItem label="Status">
                    <Badge variant={statusVariant[user.status]} dot className="capitalize">
                      {user.status}
                    </Badge>
                  </PropertyItem>
                  <PropertyItem label="Organization">{user.orgName}</PropertyItem>
                  <PropertyItem label="Role">
                    <span className="capitalize">{user.role}</span>
                  </PropertyItem>
                  <PropertyItem label="Joined">{formatDate(user.joinedAt)}</PropertyItem>
                  <PropertyItem label="Last active">{formatRelative(user.lastActiveAt)}</PropertyItem>
                  <PropertyItem label="User ID">
                    <span className="font-mono text-xs text-text-disabled">{user.id}</span>
                  </PropertyItem>
                </PropertyList>

                <div className="flex flex-col gap-2 border-t border-border pt-4">
                  <Button
                    variant="outline"
                    className="justify-start"
                    disabled={resetPassword.isPending || passwordResetSent}
                    onClick={() =>
                      void run(async () => {
                        await resetPassword.mutateAsync(user.id);
                        setPasswordResetSent(true);
                      })
                    }
                  >
                    {passwordResetSent ? "Reset email sent" : "Reset password"}
                  </Button>
                  <Button variant="outline" className="justify-start">
                    Change role
                  </Button>
                  {user.status === "suspended" ? (
                    <Button
                      variant="outline"
                      className="justify-start"
                      disabled={reinstate.isPending}
                      onClick={() => void run(() => reinstate.mutateAsync(user.id))}
                    >
                      Reinstate user
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="justify-start border-feedback-warning text-feedback-warning"
                      onClick={() =>
                        setConfirmation({
                          title: `Suspend ${user.name}?`,
                          description:
                            "This will immediately revoke their access to all workspaces. They can be reinstated later.",
                          confirmLabel: "Suspend",
                          onConfirm: () => void run(() => suspend.mutateAsync(user.id)),
                        })
                      }
                    >
                      Suspend user
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    className="justify-start"
                    onClick={() =>
                      setConfirmation({
                        title: `Delete ${user.name}?`,
                        description: "This permanently removes the user and cannot be undone.",
                        confirmLabel: "Delete",
                        onConfirm: () =>
                          void run(async () => {
                            await remove.mutateAsync(user.id);
                            setDetailId(null);
                          }),
                      })
                    }
                  >
                    Delete user
                  </Button>
                </div>
              </>
            ) : null}
          </SidePanelBody>
        </SidePanel>
      ) : null}

      <ConfirmDialog confirmation={confirmation} onClose={() => setConfirmation(null)} />
    </div>
  );
}
