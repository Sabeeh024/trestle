import { apiErrorFromResponse } from "./errors";
import { operations, type Operation } from "./operations";
import type {
  AdminUser,
  AuditLogEntry,
  AuditLogParams,
  BulkUserActionInput,
  ChangePasswordInput,
  Comment,
  ContactInput,
  CreateOrganizationInput,
  CreateProjectInput,
  CreateTaskInput,
  DashboardData,
  ForgotPasswordInput,
  InviteUserInput,
  LoginInput,
  LoginResult,
  ResetPasswordInput,
  Organization,
  OrganizationListParams,
  Paginated,
  Project,
  SessionInfo,
  ProjectListParams,
  Task,
  TaskDetail,
  SignupInput,
  SsoInput,
  TaskListParams,
  UpdateOrganizationInput,
  UpdateProfileInput,
  UpdateProjectInput,
  UpdateTaskInput,
  UpdateUserInput,
  User,
  UserListParams,
  UserRole,
} from "./types";
import type { RequestOptions, Transport } from "./transport";

/** The one URL every operation is posted to. It stays under /api so proxies and the BFF can keep one rule for the API. */
export const GRAPHQL_PATH = "/api/graphql";

interface GraphqlResponse {
  data?: Record<string, unknown> | null;
  errors?: { message?: string; extensions?: object }[];
}

export function createApi(transport: Transport) {
  /**
   * Sends one operation and returns its root field. A failed operation (GraphQL answers 200 with `errors` for most
   * of them) rejects with an ApiError carrying the same code, status and per-field messages the REST API did.
   */
  async function run<T>(op: Operation, variables?: object, options?: RequestOptions): Promise<T> {
    const body = { query: op.query, operationName: op.name, ...(variables ? { variables } : {}) };
    const response = await transport.request<GraphqlResponse>({ method: "POST", url: GRAPHQL_PATH, body, ...options });
    if (response?.errors?.length) throw apiErrorFromResponse(200, response);
    return response?.data?.[op.field] as T;
  }

  /** For operations whose answer is just "it worked". */
  const done = async (op: Operation, variables?: object) => {
    await run<boolean>(op, variables);
  };

  return {
    auth: {
      login: (input: LoginInput) => run<LoginResult>(operations.login, { input }),
      me: (options?: RequestOptions) => run<User>(operations.me, undefined, options),
      signup: (input: SignupInput) => run<LoginResult>(operations.signup, { input }),
      sso: (input: SsoInput) => run<LoginResult>(operations.sso, { input }),
      forgotPassword: (input: ForgotPasswordInput) => done(operations.forgotPassword, { input }),
      changePassword: (input: ChangePasswordInput) => done(operations.changePassword, { input }),
      sessions: {
        list: (options?: RequestOptions) => run<SessionInfo[]>(operations.sessions, undefined, options),
        revoke: (id: string) => done(operations.revokeSession, { id }),
        /** Signs out every other device; this one stays signed in. */
        revokeOthers: () => done(operations.revokeOtherSessions),
      },
      resetPassword: (input: ResetPasswordInput) => done(operations.resetPassword, { input }),
      updateProfile: (input: UpdateProfileInput) => run<User>(operations.updateProfile, { input }),
      logout: () => done(operations.logout),
    },

    contact: {
      send: (input: ContactInput) => done(operations.sendContactMessage, { input }),
    },

    dashboard: {
      get: (options?: RequestOptions) => run<DashboardData>(operations.dashboard, undefined, options),
    },

    projects: {
      list: (params?: ProjectListParams, options?: RequestOptions) => run<Paginated<Project>>(operations.projects, params, options),
      get: (id: string, options?: RequestOptions) => run<Project>(operations.project, { id }, options),
      create: (input: CreateProjectInput) => run<Project>(operations.createProject, { input }),
      update: (id: string, input: UpdateProjectInput) => run<Project>(operations.updateProject, { id, input }),
      remove: (id: string) => done(operations.deleteProject, { id }),
      tasks: (id: string, params?: { page?: number; pageSize?: number }, options?: RequestOptions) =>
        run<Paginated<Task>>(operations.projectTasks, { id, ...params }, options),
    },

    tasks: {
      list: (params?: TaskListParams, options?: RequestOptions) => run<Paginated<Task>>(operations.tasks, params, options),
      get: (id: string, options?: RequestOptions) => run<TaskDetail>(operations.task, { id }, options),
      create: (input: CreateTaskInput) => run<TaskDetail>(operations.createTask, { input }),
      update: (id: string, input: UpdateTaskInput) => run<TaskDetail>(operations.updateTask, { id, input }),
      remove: (id: string) => done(operations.deleteTask, { id }),
      addComment: (id: string, body: string) => run<Comment>(operations.addComment, { taskId: id, body }),
    },

    admin: {
      users: {
        list: (params?: UserListParams, options?: RequestOptions) => run<Paginated<AdminUser>>(operations.adminUsers, params, options),
        get: (id: string, options?: RequestOptions) => run<AdminUser>(operations.adminUser, { id }, options),
        invite: (input: InviteUserInput) => run<AdminUser>(operations.inviteUser, { input }),
        changeRole: (id: string, role: UserRole) => run<AdminUser>(operations.updateUser, { id, input: { role } }),
        update: (id: string, input: UpdateUserInput) => run<AdminUser>(operations.updateUser, { id, input }),
        suspend: (id: string) => run<AdminUser>(operations.suspendUser, { id }),
        reinstate: (id: string) => run<AdminUser>(operations.reinstateUser, { id }),
        resetPassword: (id: string) => done(operations.resetUserPassword, { id }),
        remove: (id: string) => done(operations.deleteUser, { id }),
        bulk: (input: BulkUserActionInput) => run<{ affected: number }>(operations.bulkUserAction, input),
      },
      organizations: {
        list: (params?: OrganizationListParams, options?: RequestOptions) =>
          run<Paginated<Organization>>(operations.adminOrganizations, params, options),
        get: (id: string, options?: RequestOptions) => run<Organization>(operations.adminOrganization, { id }, options),
        create: (input: CreateOrganizationInput) => run<Organization>(operations.createOrganization, { input }),
        update: (id: string, input: UpdateOrganizationInput) => run<Organization>(operations.updateOrganization, { id, input }),
      },
      auditLog: {
        list: (params?: AuditLogParams, options?: RequestOptions) => run<Paginated<AuditLogEntry>>(operations.auditLog, params, options),
      },
    },
  };
}

export type Api = ReturnType<typeof createApi>;
