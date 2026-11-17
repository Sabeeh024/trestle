// Every GraphQL operation the apps send, as plain documents (no code generation, no GraphQL runtime in the browser
// bundle). The API's tests validate each one against the real schema, so a field renamed on the server fails there
// rather than in a browser.

interface Fragment {
  name: string;
  text: string;
  deps: Fragment[];
}

const fragment = (name: string, on: string, fields: string, ...deps: Fragment[]): Fragment => ({
  name,
  text: `fragment ${name} on ${on} { ${fields} }`,
  deps,
});

const summary = fragment("SummaryFields", "UserSummary", "id name initials");
const user = fragment("UserFields", "User", "id name initials email orgId orgName role status joinedAt lastActiveAt");
const organization = fragment("OrganizationFields", "Organization", "id name plan status memberCount createdAt");
const project = fragment("ProjectFields", "Project", "id name description color status progress members { ...SummaryFields } dueDate updatedAt", summary);
const task = fragment("TaskFields", "Task", "id projectId title description status priority assignee { ...SummaryFields } dueDate updatedAt", summary);
const taskDetail = fragment(
  "TaskDetailFields",
  "TaskDetail",
  "id projectId title description status priority assignee { ...SummaryFields } dueDate updatedAt comments { id author { ...SummaryFields } body createdAt }",
  summary,
);

function withFragments(body: string, fragments: Fragment[]) {
  const seen = new Map<string, string>();
  const visit = (f: Fragment) => {
    if (seen.has(f.name)) return;
    seen.set(f.name, f.text);
    f.deps.forEach(visit);
  };
  fragments.forEach(visit);
  return [body, ...seen.values()].join("\n");
}

export interface Operation {
  /** The operation's name, which also shows up in server logs and browser devtools. */
  name: string;
  query: string;
  /** The root field whose value is the operation's result. */
  field: string;
}

/** `body` is the operation text; its name and root field are read from it, so they cannot disagree. */
function operation(body: string, ...fragments: Fragment[]): Operation {
  const match = /^\s*(?:query|mutation)\s+(\w+)[^{]*\{\s*(\w+)/.exec(body);
  if (!match) throw new Error(`Not a named operation: ${body.slice(0, 40)}`);
  return { name: match[1]!, query: withFragments(body, fragments), field: match[2]! };
}

const loginResult = "token user { ...UserFields }";
const page = "meta { page pageSize total }";

export const operations = {
  // ---- auth ----
  login: operation(`mutation Login($input: LoginInput!) { login(input: $input) { ${loginResult} } }`, user),
  signup: operation(`mutation Signup($input: SignupInput!) { signup(input: $input) { ${loginResult} } }`, user),
  sso: operation(`mutation Sso($input: SsoInput!) { sso(input: $input) { ${loginResult} } }`, user),
  me: operation("query Me { me { ...UserFields } }", user),
  forgotPassword: operation("mutation ForgotPassword($input: ForgotPasswordInput!) { forgotPassword(input: $input) }"),
  resetPassword: operation("mutation ResetPassword($input: ResetPasswordInput!) { resetPassword(input: $input) }"),
  changePassword: operation("mutation ChangePassword($input: ChangePasswordInput!) { changePassword(input: $input) }"),
  updateProfile: operation("mutation UpdateProfile($input: UpdateProfileInput!) { updateProfile(input: $input) { ...UserFields } }", user),
  logout: operation("mutation Logout { logout }"),
  sessions: operation("query Sessions { sessions { id createdAt lastUsedAt userAgent current } }"),
  revokeSession: operation("mutation RevokeSession($id: ID!) { revokeSession(id: $id) }"),
  revokeOtherSessions: operation("mutation RevokeOtherSessions { revokeOtherSessions }"),
  sendContactMessage: operation("mutation SendContactMessage($input: ContactInput!) { sendContactMessage(input: $input) }"),

  // ---- workspace ----
  dashboard: operation(
    "query Dashboard { dashboard { me { ...UserFields } recentProjects { ...ProjectFields } myTasks { ...TaskFields } } }",
    user,
    project,
    task,
  ),
  projects: operation(
    `query Projects($page: Int, $pageSize: Int, $q: String, $status: ProjectStatus) { projects(page: $page, pageSize: $pageSize, q: $q, status: $status) { data { ...ProjectFields } ${page} } }`,
    project,
  ),
  project: operation("query Project($id: ID!) { project(id: $id) { ...ProjectFields } }", project),
  projectTasks: operation(
    `query ProjectTasks($id: ID!, $page: Int, $pageSize: Int) { projectTasks(id: $id, page: $page, pageSize: $pageSize) { data { ...TaskFields } ${page} } }`,
    task,
  ),
  createProject: operation("mutation CreateProject($input: CreateProjectInput!) { createProject(input: $input) { ...ProjectFields } }", project),
  updateProject: operation("mutation UpdateProject($id: ID!, $input: UpdateProjectInput!) { updateProject(id: $id, input: $input) { ...ProjectFields } }", project),
  deleteProject: operation("mutation DeleteProject($id: ID!) { deleteProject(id: $id) }"),

  tasks: operation(
    `query Tasks($page: Int, $pageSize: Int, $projectId: ID, $assignee: String, $status: TaskStatus, $priority: Priority, $q: String) { tasks(page: $page, pageSize: $pageSize, projectId: $projectId, assignee: $assignee, status: $status, priority: $priority, q: $q) { data { ...TaskFields } ${page} } }`,
    task,
  ),
  task: operation("query Task($id: ID!) { task(id: $id) { ...TaskDetailFields } }", taskDetail),
  createTask: operation("mutation CreateTask($input: CreateTaskInput!) { createTask(input: $input) { ...TaskDetailFields } }", taskDetail),
  updateTask: operation("mutation UpdateTask($id: ID!, $input: UpdateTaskInput!) { updateTask(id: $id, input: $input) { ...TaskDetailFields } }", taskDetail),
  deleteTask: operation("mutation DeleteTask($id: ID!) { deleteTask(id: $id) }"),
  addComment: operation("mutation AddComment($taskId: ID!, $body: String) { addComment(taskId: $taskId, body: $body) { id author { ...SummaryFields } body createdAt } }", summary),

  // ---- admin ----
  adminUsers: operation(
    `query AdminUsers($page: Int, $pageSize: Int, $q: String, $role: UserRole, $status: UserStatus, $orgId: ID, $sort: UserSortKey, $direction: SortDirection) { adminUsers(page: $page, pageSize: $pageSize, q: $q, role: $role, status: $status, orgId: $orgId, sort: $sort, direction: $direction) { data { ...UserFields } ${page} } }`,
    user,
  ),
  adminUser: operation("query AdminUser($id: ID!) { adminUser(id: $id) { ...UserFields } }", user),
  inviteUser: operation("mutation InviteUser($input: InviteUserInput!) { inviteUser(input: $input) { ...UserFields } }", user),
  updateUser: operation("mutation UpdateUser($id: ID!, $input: UpdateUserInput!) { updateUser(id: $id, input: $input) { ...UserFields } }", user),
  suspendUser: operation("mutation SuspendUser($id: ID!) { suspendUser(id: $id) { ...UserFields } }", user),
  reinstateUser: operation("mutation ReinstateUser($id: ID!) { reinstateUser(id: $id) { ...UserFields } }", user),
  resetUserPassword: operation("mutation ResetUserPassword($id: ID!) { resetUserPassword(id: $id) }"),
  deleteUser: operation("mutation DeleteUser($id: ID!) { deleteUser(id: $id) }"),
  bulkUserAction: operation("mutation BulkUserAction($action: BulkAction!, $ids: [ID!]!) { bulkUserAction(action: $action, ids: $ids) { affected } }"),
  adminOrganizations: operation(
    `query AdminOrganizations($page: Int, $pageSize: Int, $q: String, $plan: OrgPlan, $status: OrgStatus, $direction: SortDirection) { adminOrganizations(page: $page, pageSize: $pageSize, q: $q, plan: $plan, status: $status, direction: $direction) { data { ...OrganizationFields } ${page} } }`,
    organization,
  ),
  adminOrganization: operation("query AdminOrganization($id: ID!) { adminOrganization(id: $id) { ...OrganizationFields } }", organization),
  createOrganization: operation("mutation CreateOrganization($input: CreateOrganizationInput!) { createOrganization(input: $input) { ...OrganizationFields } }", organization),
  updateOrganization: operation("mutation UpdateOrganization($id: ID!, $input: UpdateOrganizationInput!) { updateOrganization(id: $id, input: $input) { ...OrganizationFields } }", organization),
  auditLog: operation(
    `query AuditLog($page: Int, $pageSize: Int, $q: String, $action: AuditAction) { auditLog(page: $page, pageSize: $pageSize, q: $q, action: $action) { data { id timestamp actor action target } ${page} } }`,
  ),
} satisfies Record<string, Operation>;

export type OperationName = keyof typeof operations;
