// API contract shared by the mock server and its consumers. Dates are ISO 8601 strings.

export type CategoricalColor = "purple" | "cyan" | "green" | "orange" | "blue" | "pink";
export type ProjectStatus = "active" | "planning" | "onHold";
export type TaskStatus = "todo" | "inProgress" | "inReview" | "done";
export type Priority = "urgent" | "high" | "medium" | "low";

export type UserRole = "owner" | "admin" | "member" | "viewer";
export type UserStatus = "active" | "invited" | "suspended";
export type OrgPlan = "free" | "pro" | "enterprise";
export type OrgStatus = "active" | "trialing" | "pastDue";

export type AuditAction =
  | "suspend_user"
  | "reinstate_user"
  | "delete_user"
  | "invite_user"
  | "update_role"
  | "reset_password"
  | "create_project"
  | "delete_project"
  | "create_organization"
  | "billing_charge"
  | "login_failed";

export interface User {
  id: string;
  name: string;
  initials: string;
  email: string;
  orgId: string;
  role: UserRole;
  status: UserStatus;
  joinedAt: string;
  lastActiveAt: string | null;
}

export interface AdminUser extends User {
  orgName: string;
}

export interface UserSummary {
  id: string;
  name: string;
  initials: string;
}

export interface Organization {
  id: string;
  name: string;
  plan: OrgPlan;
  status: OrgStatus;
  memberCount: number;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  color: CategoricalColor;
  status: ProjectStatus;
  progress: number;
  members: UserSummary[];
  dueDate: string | null;
  updatedAt: string;
}

export interface Comment {
  id: string;
  author: UserSummary;
  body: string;
  createdAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  assignee: UserSummary | null;
  dueDate: string | null;
  updatedAt: string;
}

export interface TaskDetail extends Task {
  comments: Comment[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: AuditAction;
  target: string;
}

export interface DashboardData {
  me: User;
  recentProjects: Project[];
  myTasks: Task[];
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

export interface ApiError {
  error: { code: string; message: string };
}
