import { useMemo, useState } from "react";

import { Button } from "@trestle/ui/components/ui/button";
import { Input } from "@trestle/ui/components/ui/input";
import { Badge } from "@trestle/ui/components/ui/badge";
import { Checkbox } from "@trestle/ui/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@trestle/ui/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@trestle/ui/components/ui/table";
import { SidePanel, SidePanelBody, SidePanelHeader } from "@trestle/ui/components/side-panel";
import { PropertyList, PropertyItem } from "@trestle/ui/components/property-list";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@trestle/ui/components/ui/alert-dialog";

import { PageHeader } from "@/components/page-header";
import { BulkActionBar } from "@/components/bulk-action-bar";
import { users, type UserStatus } from "@/lib/mock-data";

const statusVariant: Record<UserStatus, "success" | "warning" | "destructive"> = {
  active: "success",
  invited: "warning",
  suspended: "destructive",
};

export function UsersPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [search]);

  const allSelected = filtered.length > 0 && selected.length === filtered.length;
  const detail = users.find((u) => u.id === detailId) ?? null;
  const suspendUser = users.find((u) => u.id === suspendTarget) ?? null;

  function toggleAll() {
    setSelected(allSelected ? [] : filtered.map((u) => u.id));
  }

  function toggleOne(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="flex min-w-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <PageHeader
          crumb="Users"
          title="Users"
          action={<Button size="sm">+ Invite user</Button>}
        />

        <div className="px-4 pb-3">
          <Input
            placeholder="Search by name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
        </div>

        <BulkActionBar count={selected.length}>
          <Button variant="outline" size="sm">
            Suspend
          </Button>
          <Button variant="destructive" size="sm">
            Delete
          </Button>
        </BulkActionBar>

        <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
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
                {filtered.map((u) => (
                  <TableRow
                    key={u.id}
                    className="cursor-pointer"
                    data-state={selected.includes(u.id) ? "selected" : undefined}
                    onClick={() => setDetailId(u.id)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.includes(u.id)}
                        onCheckedChange={() => toggleOne(u.id)}
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
                    <TableCell className="text-text-secondary">{u.org}</TableCell>
                    <TableCell className="text-text-secondary capitalize">{u.role}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[u.status]} dot className="capitalize">
                        {u.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-text-disabled">{u.joined}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between border-t border-border bg-background-subtle px-3 py-2 text-xs text-text-secondary">
              <span>
                Showing 1–{filtered.length} of {users.length} users
              </span>
            </div>
          </div>
        </div>
      </div>

      {detail ? (
        <SidePanel>
          <SidePanelHeader onClose={() => setDetailId(null)}>User detail</SidePanelHeader>
          <SidePanelBody className="gap-4">
            <div className="flex items-center gap-3">
              <Avatar size="lg">
                <AvatarFallback>{detail.initials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-[15px] font-bold">{detail.name}</p>
                <p className="text-xs text-text-secondary">{detail.email}</p>
              </div>
            </div>

            <PropertyList>
              <PropertyItem label="Status">
                <Badge variant={statusVariant[detail.status]} dot className="capitalize">
                  {detail.status}
                </Badge>
              </PropertyItem>
              <PropertyItem label="Organization">{detail.org}</PropertyItem>
              <PropertyItem label="Role">
                <span className="capitalize">{detail.role}</span>
              </PropertyItem>
              <PropertyItem label="Joined">{detail.joined}</PropertyItem>
              <PropertyItem label="Last active">{detail.lastActive}</PropertyItem>
              <PropertyItem label="User ID">
                <span className="font-mono text-xs text-text-disabled">{detail.id}</span>
              </PropertyItem>
            </PropertyList>

            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <Button variant="outline" className="justify-start">
                Reset password
              </Button>
              <Button variant="outline" className="justify-start">
                Change role
              </Button>
              <Button
                variant="outline"
                className="justify-start border-feedback-warning text-feedback-warning"
                onClick={() => setSuspendTarget(detail.id)}
              >
                Suspend user
              </Button>
              <Button variant="destructive" className="justify-start">
                Delete user
              </Button>
            </div>
          </SidePanelBody>
        </SidePanel>
      ) : null}

      <AlertDialog open={!!suspendTarget} onOpenChange={(open) => !open && setSuspendTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend {suspendUser?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately revoke their access to all workspaces. They can be reinstated
              later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => setSuspendTarget(null)}>Suspend</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
