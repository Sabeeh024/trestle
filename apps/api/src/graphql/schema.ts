// The API's whole contract. Resolvers live in ./resolvers; the client's operations in @trestle/api-client are
// checked against this schema by a test, so the two cannot drift.
//
// Input fields are nullable on purpose: the shared zod schemas (@trestle/api-client/schemas, the same ones the forms
// use) are the one place that decides what is required, and they report a missing field as `{ field: "required" }`
// so each app can translate it. A required (`!`) field here would be rejected earlier, with a generic message.

export const typeDefs = /* GraphQL */ `
  enum UserRole { owner admin member viewer }
  enum UserStatus { active invited suspended }
  enum OrgPlan { free pro enterprise }
  enum OrgStatus { active trialing pastDue }
  enum ProjectStatus { active planning onHold archived }
  enum CategoricalColor { purple cyan green orange blue pink }
  enum TaskStatus { todo inProgress inReview done }
  enum Priority { urgent high medium low }
  enum SortDirection { asc desc }
  enum UserSortKey { name email role status joinedAt }
  enum BulkAction { suspend delete }
  enum AuditAction {
    suspend_user reinstate_user delete_user invite_user update_role reset_password create_project delete_project
    create_organization billing_charge login_failed update_user update_organization signup
  }

  type PageMeta { page: Int! pageSize: Int! total: Int! }

  type User {
    id: ID!
    name: String!
    initials: String!
    email: String!
    orgId: ID!
    orgName: String!
    role: UserRole!
    status: UserStatus!
    joinedAt: String!
    lastActiveAt: String
  }

  type UserSummary { id: ID! name: String! initials: String! }

  type Organization {
    id: ID!
    name: String!
    plan: OrgPlan!
    status: OrgStatus!
    memberCount: Int!
    createdAt: String!
  }

  type Project {
    id: ID!
    name: String!
    description: String!
    color: CategoricalColor!
    status: ProjectStatus!
    progress: Int!
    members: [UserSummary!]!
    dueDate: String
    updatedAt: String!
  }

  type Comment { id: ID! author: UserSummary! body: String! createdAt: String! }

  type Task {
    id: ID!
    projectId: ID!
    title: String!
    description: String!
    status: TaskStatus!
    priority: Priority!
    assignee: UserSummary
    dueDate: String
    updatedAt: String!
  }

  type TaskDetail {
    id: ID!
    projectId: ID!
    title: String!
    description: String!
    status: TaskStatus!
    priority: Priority!
    assignee: UserSummary
    dueDate: String
    updatedAt: String!
    comments: [Comment!]!
  }

  type AuditLogEntry { id: ID! timestamp: String! actor: String! action: AuditAction! target: String! }

  type SessionInfo {
    id: ID!
    createdAt: String!
    lastUsedAt: String!
    userAgent: String
    current: Boolean!
  }

  type LoginResult {
    "Null when the client asked for a cookie session: the token is then never exposed to the page."
    token: String
    user: User!
  }

  type DashboardData { me: User! recentProjects: [Project!]! myTasks: [Task!]! }
  type BulkResult { affected: Int! }

  type ProjectPage { data: [Project!]! meta: PageMeta! }
  type TaskPage { data: [Task!]! meta: PageMeta! }
  type UserPage { data: [User!]! meta: PageMeta! }
  type OrganizationPage { data: [Organization!]! meta: PageMeta! }
  type AuditLogPage { data: [AuditLogEntry!]! meta: PageMeta! }

  input LoginInput { email: String password: String }
  input SignupInput { name: String email: String password: String }
  input SsoInput { email: String }
  input ForgotPasswordInput { email: String }
  input ResetPasswordInput { token: String password: String }
  input ChangePasswordInput { currentPassword: String newPassword: String }
  input UpdateProfileInput { name: String email: String }
  input ContactInput { name: String email: String company: String message: String }

  input CreateProjectInput {
    name: String
    description: String
    color: CategoricalColor
    status: ProjectStatus
    dueDate: String
  }
  "A field left out is unchanged; a null dueDate clears the date."
  input UpdateProjectInput {
    name: String
    description: String
    color: CategoricalColor
    status: ProjectStatus
    dueDate: String
  }
  input CreateTaskInput {
    projectId: ID
    title: String
    description: String
    status: TaskStatus
    priority: Priority
    assigneeId: ID
    dueDate: String
  }
  "A field left out is unchanged; a null assigneeId or dueDate clears it."
  input UpdateTaskInput {
    title: String
    description: String
    status: TaskStatus
    priority: Priority
    assigneeId: ID
    dueDate: String
  }
  input InviteUserInput { email: String orgId: ID name: String role: UserRole }
  input UpdateUserInput { name: String email: String role: UserRole }
  input CreateOrganizationInput { name: String plan: OrgPlan }
  input UpdateOrganizationInput { name: String plan: OrgPlan }

  type Query {
    me: User!
    sessions: [SessionInfo!]!
    dashboard: DashboardData!

    projects(page: Int, pageSize: Int, q: String, status: ProjectStatus): ProjectPage!
    project(id: ID!): Project!
    projectTasks(id: ID!, page: Int, pageSize: Int): TaskPage!

    "assignee is a user id, or \\"me\\"."
    tasks(page: Int, pageSize: Int, projectId: ID, assignee: String, status: TaskStatus, priority: Priority, q: String): TaskPage!
    task(id: ID!): TaskDetail!

    "The admin queries need an owner or admin; other admins see only their own organization."
    adminUsers(
      page: Int
      pageSize: Int
      q: String
      role: UserRole
      status: UserStatus
      orgId: ID
      sort: UserSortKey
      direction: SortDirection
    ): UserPage!
    adminUser(id: ID!): User!
    adminOrganizations(page: Int, pageSize: Int, q: String, plan: OrgPlan, status: OrgStatus, direction: SortDirection): OrganizationPage!
    adminOrganization(id: ID!): Organization!
    auditLog(page: Int, pageSize: Int, q: String, action: AuditAction): AuditLogPage!
  }

  type Mutation {
    login(input: LoginInput!): LoginResult!
    signup(input: SignupInput!): LoginResult!
    sso(input: SsoInput!): LoginResult!
    "Always true, so the answer never reveals whether an address has an account."
    forgotPassword(input: ForgotPasswordInput!): Boolean!
    resetPassword(input: ResetPasswordInput!): Boolean!
    logout: Boolean!
    changePassword(input: ChangePasswordInput!): Boolean!
    updateProfile(input: UpdateProfileInput!): User!
    revokeSession(id: ID!): Boolean!
    "Signs out every other device; this one stays signed in."
    revokeOtherSessions: Boolean!
    sendContactMessage(input: ContactInput!): Boolean!

    createProject(input: CreateProjectInput!): Project!
    updateProject(id: ID!, input: UpdateProjectInput!): Project!
    deleteProject(id: ID!): Boolean!

    createTask(input: CreateTaskInput!): TaskDetail!
    updateTask(id: ID!, input: UpdateTaskInput!): TaskDetail!
    deleteTask(id: ID!): Boolean!
    addComment(taskId: ID!, body: String): Comment!

    inviteUser(input: InviteUserInput!): User!
    updateUser(id: ID!, input: UpdateUserInput!): User!
    suspendUser(id: ID!): User!
    reinstateUser(id: ID!): User!
    resetUserPassword(id: ID!): Boolean!
    deleteUser(id: ID!): Boolean!
    bulkUserAction(action: BulkAction!, ids: [ID!]!): BulkResult!
    createOrganization(input: CreateOrganizationInput!): Organization!
    updateOrganization(id: ID!, input: UpdateOrganizationInput!): Organization!
  }
`;
