// Mock admin data for prototyping the panel's screens — not a real API.

export type UserStatus = "active" | "invited" | "suspended";
export type UserRole = "owner" | "admin" | "member" | "viewer";

export interface AdminUser {
  id: string;
  name: string;
  initials: string;
  email: string;
  org: string;
  role: UserRole;
  status: UserStatus;
  joined: string;
  lastActive: string;
}

export const users: AdminUser[] = [
  { id: "usr_000001", name: "Alex Kim", initials: "AK", email: "alex.kim@northwind.io", org: "Northwind", role: "admin", status: "active", joined: "Jan 14, 2025", lastActive: "2h ago" },
  { id: "usr_000002", name: "Maya Patel", initials: "MP", email: "maya@fontaineco.com", org: "Fontaine Co.", role: "member", status: "active", joined: "Mar 2, 2025", lastActive: "10m ago" },
  { id: "usr_000003", name: "Jordan Kim", initials: "JK", email: "jordan.kim@trestle.io", org: "Trestle Labs", role: "owner", status: "active", joined: "Aug 20, 2024", lastActive: "Just now" },
  { id: "usr_000004", name: "Sam Rivera", initials: "SR", email: "sam.r@umbralabs.dev", org: "Umbra Labs", role: "member", status: "invited", joined: "Sep 19, 2026", lastActive: "—" },
  { id: "usr_000005", name: "Priya Nair", initials: "PN", email: "priya@verity.app", org: "Verity", role: "admin", status: "active", joined: "Feb 8, 2025", lastActive: "1d ago" },
  { id: "usr_000006", name: "Tom Baker", initials: "TB", email: "tom.baker@haldane.co", org: "Haldane", role: "member", status: "suspended", joined: "Nov 30, 2024", lastActive: "3w ago" },
  { id: "usr_000007", name: "Elena Cho", initials: "EC", email: "elena.cho@northwind.io", org: "Northwind", role: "member", status: "active", joined: "Apr 17, 2025", lastActive: "4h ago" },
  { id: "usr_000008", name: "Noah Williams", initials: "NW", email: "noah@fontaineco.com", org: "Fontaine Co.", role: "viewer", status: "invited", joined: "Sep 21, 2026", lastActive: "—" },
];

export type OrgPlan = "free" | "pro" | "enterprise";
export type OrgStatus = "active" | "trialing" | "pastDue";

export interface Organization {
  id: string;
  name: string;
  plan: OrgPlan;
  members: number;
  status: OrgStatus;
  created: string;
}

export const organizations: Organization[] = [
  { id: "org_trestle", name: "Trestle Labs", plan: "enterprise", members: 24, status: "active", created: "Aug 20, 2024" },
  { id: "org_northwind", name: "Northwind", plan: "pro", members: 18, status: "active", created: "Jan 12, 2025" },
  { id: "org_fontaine", name: "Fontaine Co.", plan: "pro", members: 9, status: "active", created: "Mar 2, 2025" },
  { id: "org_umbra", name: "Umbra Labs", plan: "free", members: 3, status: "trialing", created: "Sep 19, 2026" },
  { id: "org_verity", name: "Verity", plan: "pro", members: 12, status: "active", created: "Feb 8, 2025" },
  { id: "org_haldane", name: "Haldane", plan: "free", members: 5, status: "pastDue", created: "Nov 30, 2024" },
];

export type AuditAction =
  | "suspendUser"
  | "createProject"
  | "billingCharge"
  | "inviteUser"
  | "deleteProject"
  | "updateRole"
  | "loginFailed"
  | "createOrganization";

export interface AuditLogEntry {
  time: string;
  actor: string;
  action: AuditAction;
  target: string;
}

export const auditLog: AuditLogEntry[] = [
  { time: "2026-09-23 14:02:11", actor: "jordan.kim@trestle.io", action: "suspendUser", target: "tom.baker@haldane.co" },
  { time: "2026-09-23 11:47:03", actor: "alex.kim@northwind.io", action: "createProject", target: "Website Redesign" },
  { time: "2026-09-22 19:15:40", actor: "system", action: "billingCharge", target: "Fontaine Co. — $108.00" },
  { time: "2026-09-22 16:30:12", actor: "maya@fontaineco.com", action: "inviteUser", target: "noah@fontaineco.com" },
  { time: "2026-09-22 09:05:57", actor: "jordan.kim@trestle.io", action: "deleteProject", target: "Legacy Migration" },
  { time: "2026-09-21 22:41:19", actor: "priya@verity.app", action: "updateRole", target: "sam.r@umbralabs.dev → Member" },
  { time: "2026-09-21 13:12:05", actor: "system", action: "loginFailed", target: "unknown@haldane.co" },
  { time: "2026-09-20 08:58:44", actor: "jordan.kim@trestle.io", action: "createOrganization", target: "Umbra Labs" },
];
