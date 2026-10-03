import type {
  AuditAction,
  CategoricalColor,
  OrgPlan,
  OrgStatus,
  Priority,
  ProjectStatus,
  TaskStatus,
  User,
} from "../types";

export interface OrgRecord {
  id: string;
  name: string;
  plan: OrgPlan;
  status: OrgStatus;
  createdAt: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  description: string;
  color: CategoricalColor;
  status: ProjectStatus;
  progress: number;
  memberIds: string[];
  dueDate: string | null;
  updatedAt: string;
}

export interface CommentRecord {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface TaskRecord {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  assigneeId: string | null;
  dueDate: string | null;
  updatedAt: string;
}

export interface AuditRecord {
  id: string;
  timestamp: string;
  actor: string;
  action: AuditAction;
  target: string;
}

export interface Seed {
  users: User[];
  orgs: OrgRecord[];
  projects: ProjectRecord[];
  tasks: TaskRecord[];
  comments: CommentRecord[];
  audit: AuditRecord[];
}

// The signed-in user for the product app and the admin panel.
export const ME_ID = "usr_000003";

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

export function createSeed(): Seed {
  const users: User[] = [
    { id: "usr_000001", name: "Alex Kim", initials: "AK", email: "alex.kim@northwind.io", orgId: "org_northwind", role: "admin", status: "active", joinedAt: "2025-01-14T09:00:00.000Z", lastActiveAt: hoursAgo(2) },
    { id: "usr_000002", name: "Maya Patel", initials: "MP", email: "maya@fontaineco.com", orgId: "org_fontaine", role: "member", status: "active", joinedAt: "2025-03-02T09:00:00.000Z", lastActiveAt: hoursAgo(0.2) },
    { id: ME_ID, name: "Jordan Kim", initials: "JK", email: "jordan.kim@trestle.io", orgId: "org_trestle", role: "owner", status: "active", joinedAt: "2024-08-20T09:00:00.000Z", lastActiveAt: hoursAgo(0) },
    { id: "usr_000004", name: "Sam Rivera", initials: "SR", email: "sam.r@umbralabs.dev", orgId: "org_umbra", role: "member", status: "invited", joinedAt: "2026-09-19T09:00:00.000Z", lastActiveAt: null },
    { id: "usr_000005", name: "Priya Nair", initials: "PN", email: "priya@verity.app", orgId: "org_verity", role: "admin", status: "active", joinedAt: "2025-02-08T09:00:00.000Z", lastActiveAt: hoursAgo(24) },
    { id: "usr_000006", name: "Tom Baker", initials: "TB", email: "tom.baker@haldane.co", orgId: "org_haldane", role: "member", status: "suspended", joinedAt: "2024-11-30T09:00:00.000Z", lastActiveAt: hoursAgo(504) },
    { id: "usr_000007", name: "Elena Cho", initials: "EC", email: "elena.cho@northwind.io", orgId: "org_northwind", role: "member", status: "active", joinedAt: "2025-04-17T09:00:00.000Z", lastActiveAt: hoursAgo(4) },
    { id: "usr_000008", name: "Noah Williams", initials: "NW", email: "noah@fontaineco.com", orgId: "org_fontaine", role: "viewer", status: "invited", joinedAt: "2026-09-21T09:00:00.000Z", lastActiveAt: null },
    { id: "usr_000009", name: "Jamie Singh", initials: "JS", email: "jamie.singh@trestle.io", orgId: "org_trestle", role: "member", status: "active", joinedAt: "2025-05-06T09:00:00.000Z", lastActiveAt: hoursAgo(6) },
  ];

  const orgs: OrgRecord[] = [
    { id: "org_trestle", name: "Trestle Labs", plan: "enterprise", status: "active", createdAt: "2024-08-20T09:00:00.000Z" },
    { id: "org_northwind", name: "Northwind", plan: "pro", status: "active", createdAt: "2025-01-12T09:00:00.000Z" },
    { id: "org_fontaine", name: "Fontaine Co.", plan: "pro", status: "active", createdAt: "2025-03-02T09:00:00.000Z" },
    { id: "org_umbra", name: "Umbra Labs", plan: "free", status: "trialing", createdAt: "2026-09-19T09:00:00.000Z" },
    { id: "org_verity", name: "Verity", plan: "pro", status: "active", createdAt: "2025-02-08T09:00:00.000Z" },
    { id: "org_haldane", name: "Haldane", plan: "free", status: "pastDue", createdAt: "2024-11-30T09:00:00.000Z" },
  ];

  const projects: ProjectRecord[] = [
    { id: "website-redesign", name: "Website Redesign", description: "Homepage, pricing, and blog templates", color: "purple", status: "active", progress: 72, memberIds: ["usr_000001", "usr_000002", "usr_000009"], dueDate: "2026-10-10", updatedAt: hoursAgo(2) },
    { id: "mobile-app-v2", name: "Mobile App v2", description: "Native app redesign for iOS/Android", color: "cyan", status: "active", progress: 45, memberIds: ["usr_000002", ME_ID], dueDate: "2026-11-02", updatedAt: hoursAgo(5) },
    { id: "q3-marketing-campaign", name: "Q3 Marketing Campaign", description: "Launch campaign for Q3 product push", color: "green", status: "active", progress: 90, memberIds: ["usr_000009"], dueDate: "2026-09-28", updatedAt: hoursAgo(24) },
    { id: "api-migration", name: "API Migration", description: "Migrating auth to new identity provider", color: "orange", status: "active", progress: 30, memberIds: ["usr_000001", ME_ID], dueDate: "2026-12-15", updatedAt: hoursAgo(72) },
    { id: "design-system-audit", name: "Design System Audit", description: "Review component coverage and gaps", color: "blue", status: "planning", progress: 5, memberIds: [ME_ID], dueDate: "2026-11-20", updatedAt: hoursAgo(144) },
    { id: "customer-portal", name: "Customer Portal", description: "Self-serve billing and support portal", color: "pink", status: "onHold", progress: 55, memberIds: ["usr_000002"], dueDate: null, updatedAt: hoursAgo(336) },
  ];

  const task = (
    id: string,
    projectId: string,
    title: string,
    priority: Priority,
    status: TaskStatus,
    assigneeId: string | null,
    dueDate: string | null,
    description = "",
  ): TaskRecord => ({ id, projectId, title, description, status, priority, assigneeId, dueDate, updatedAt: hoursAgo(3) });

  const tasks: TaskRecord[] = [
    task("TASK-104", "website-redesign", "Fix login bug on Safari", "urgent", "todo", "usr_000002", "2026-09-23", "Safari on iOS silently fails the login POST request when third-party cookies are blocked. Reproduce with Safari 17 + private browsing."),
    task("TASK-87", "website-redesign", "Write Q3 campaign brief", "medium", "todo", ME_ID, "2026-09-30"),
    task("TASK-98", "website-redesign", "Redesign onboarding flow", "high", "inProgress", "usr_000001", "2026-09-25"),
    task("TASK-121", "website-redesign", "Build responsive nav", "medium", "inProgress", "usr_000002", "2026-10-05"),
    task("TASK-73", "website-redesign", "Review PR #482", "low", "inReview", "usr_000009", "2026-09-24"),
    task("TASK-56", "website-redesign", "Set up design tokens", "low", "done", ME_ID, null),
    task("TASK-112", "api-migration", "Migrate auth service", "high", "inProgress", ME_ID, "2026-10-02"),
    task("TASK-130", "mobile-app-v2", "Draft mobile onboarding screens", "medium", "todo", ME_ID, "2026-10-12"),
    task("TASK-131", "design-system-audit", "Audit button variants", "low", "todo", ME_ID, "2026-11-01"),
  ];

  const comments: CommentRecord[] = [
    { id: "cmt_1", taskId: "TASK-104", authorId: "usr_000001", body: "Can repro on iOS 17.2. Looks like it's the SameSite=Strict cookie flag.", createdAt: hoursAgo(2) },
    { id: "cmt_2", taskId: "TASK-104", authorId: "usr_000002", body: "Switching to SameSite=Lax for the auth cookie now, will push a fix shortly.", createdAt: hoursAgo(0.75) },
  ];

  const audit: AuditRecord[] = [
    { id: "aud_8", timestamp: "2026-09-23T14:02:11.000Z", actor: "jordan.kim@trestle.io", action: "suspend_user", target: "tom.baker@haldane.co" },
    { id: "aud_7", timestamp: "2026-09-23T11:47:03.000Z", actor: "alex.kim@northwind.io", action: "create_project", target: "Website Redesign" },
    { id: "aud_6", timestamp: "2026-09-22T19:15:40.000Z", actor: "system", action: "billing_charge", target: "Fontaine Co. — $108.00" },
    { id: "aud_5", timestamp: "2026-09-22T16:30:12.000Z", actor: "maya@fontaineco.com", action: "invite_user", target: "noah@fontaineco.com" },
    { id: "aud_4", timestamp: "2026-09-22T09:05:57.000Z", actor: "jordan.kim@trestle.io", action: "delete_project", target: "Legacy Migration" },
    { id: "aud_3", timestamp: "2026-09-21T22:41:19.000Z", actor: "priya@verity.app", action: "update_role", target: "sam.r@umbralabs.dev → Member" },
    { id: "aud_2", timestamp: "2026-09-21T13:12:05.000Z", actor: "system", action: "login_failed", target: "unknown@haldane.co" },
    { id: "aud_1", timestamp: "2026-09-20T08:58:44.000Z", actor: "jordan.kim@trestle.io", action: "create_organization", target: "Umbra Labs" },
  ];

  return { users, orgs, projects, tasks, comments, audit };
}
