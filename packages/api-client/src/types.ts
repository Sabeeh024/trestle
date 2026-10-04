// API contract shared by the mock server and its consumers. Dates are ISO 8601 strings.

export type CategoricalColor = "purple" | "cyan" | "green" | "orange" | "blue" | "pink";
export type ProjectStatus = "active" | "planning" | "onHold" | "archived";
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
  | "login_failed"
  | "update_user"
  | "update_organization"
  | "signup";

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
  error: { code: string; message: string; fields?: Record<string, string> };
}

// ---- Request shapes ----

export interface PageParams {
  page?: number;
  pageSize?: number;
}

export interface ProjectListParams extends PageParams {
  q?: string;
  status?: ProjectStatus;
}

export interface TaskListParams extends PageParams {
  projectId?: string;
  /** A user id, or "me" for the signed-in user. */
  assignee?: string;
  status?: TaskStatus;
  priority?: Priority;
  q?: string;
}

export type UserSortKey = "name" | "email" | "role" | "status" | "joinedAt";

export interface UserListParams extends PageParams {
  q?: string;
  role?: UserRole;
  status?: UserStatus;
  orgId?: string;
  sort?: UserSortKey;
  direction?: "asc" | "desc";
}

export interface OrganizationListParams extends PageParams {
  q?: string;
  plan?: OrgPlan;
  status?: OrgStatus;
  direction?: "asc" | "desc";
}

export interface AuditLogParams extends PageParams {
  q?: string;
  action?: AuditAction;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface SignupInput {
  name: string;
  email: string;
  password: string;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface SsoInput {
  email: string;
}

export interface UpdateProfileInput {
  name: string;
  email: string;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  role?: UserRole;
}

export interface UpdateOrganizationInput {
  name: string;
  plan?: OrgPlan;
}

export interface LoginResult {
  token: string;
  user: User;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  color?: CategoricalColor;
  status?: ProjectStatus;
  dueDate?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  color?: CategoricalColor;
  status?: ProjectStatus;
  progress?: number;
  dueDate?: string | null;
}

export interface CreateTaskInput {
  projectId: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  assigneeId?: string;
  dueDate?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  assigneeId?: string | null;
  dueDate?: string | null;
}

export interface InviteUserInput {
  email: string;
  orgId: string;
  name?: string;
  role?: UserRole;
}

export interface BulkUserActionInput {
  action: "suspend" | "delete";
  ids: string[];
}

export interface CreateOrganizationInput {
  name: string;
  plan?: OrgPlan;
}
