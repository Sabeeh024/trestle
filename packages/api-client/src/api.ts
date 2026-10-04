import type {
  AdminUser,
  AuditLogEntry,
  AuditLogParams,
  BulkUserActionInput,
  Comment,
  CreateOrganizationInput,
  CreateProjectInput,
  CreateTaskInput,
  DashboardData,
  ForgotPasswordInput,
  InviteUserInput,
  LoginInput,
  LoginResult,
  Organization,
  OrganizationListParams,
  Paginated,
  Project,
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

type Envelope<T> = { data: T };

export function createApi(transport: Transport) {
  const get = async <T>(url: string, params?: object, options?: RequestOptions) =>
    (await transport.request<Envelope<T>>({ method: "GET", url, params, ...options })).data;

  const list = <T>(url: string, params?: object, options?: RequestOptions) =>
    transport.request<Paginated<T>>({ method: "GET", url, params, ...options });

  const send = async <T>(method: "POST" | "PATCH", url: string, body?: object) =>
    (await transport.request<Envelope<T>>({ method, url, body })).data;

  const remove = async (url: string) => {
    await transport.request<void>({ method: "DELETE", url });
  };

  const post = async (url: string) => {
    await transport.request<void>({ method: "POST", url });
  };

  return {
    auth: {
      login: (input: LoginInput) => send<LoginResult>("POST", "/api/auth/login", input),
      me: (options?: RequestOptions) => get<User>("/api/auth/me", undefined, options),
      signup: (input: SignupInput) => send<LoginResult>("POST", "/api/auth/signup", input),
      sso: (input: SsoInput) => send<LoginResult>("POST", "/api/auth/sso", input),
      forgotPassword: async (input: ForgotPasswordInput) => {
        await transport.request<void>({ method: "POST", url: "/api/auth/forgot-password", body: input });
      },
      updateProfile: (input: UpdateProfileInput) => send<User>("PATCH", "/api/auth/me", input),
      logout: () => post("/api/auth/logout"),
    },

    dashboard: {
      get: (options?: RequestOptions) => get<DashboardData>("/api/dashboard", undefined, options),
    },

    projects: {
      list: (params?: ProjectListParams, options?: RequestOptions) => list<Project>("/api/projects", params, options),
      get: (id: string, options?: RequestOptions) => get<Project>(`/api/projects/${id}`, undefined, options),
      create: (input: CreateProjectInput) => send<Project>("POST", "/api/projects", input),
      update: (id: string, input: UpdateProjectInput) => send<Project>("PATCH", `/api/projects/${id}`, input),
      remove: (id: string) => remove(`/api/projects/${id}`),
      tasks: (id: string, params?: { page?: number; pageSize?: number }, options?: RequestOptions) =>
        list<Task>(`/api/projects/${id}/tasks`, params, options),
    },

    tasks: {
      list: (params?: TaskListParams, options?: RequestOptions) => list<Task>("/api/tasks", params, options),
      get: (id: string, options?: RequestOptions) => get<TaskDetail>(`/api/tasks/${id}`, undefined, options),
      create: (input: CreateTaskInput) => send<TaskDetail>("POST", "/api/tasks", input),
      update: (id: string, input: UpdateTaskInput) => send<TaskDetail>("PATCH", `/api/tasks/${id}`, input),
      remove: (id: string) => remove(`/api/tasks/${id}`),
      addComment: (id: string, body: string) => send<Comment>("POST", `/api/tasks/${id}/comments`, { body }),
    },

    admin: {
      users: {
        list: (params?: UserListParams, options?: RequestOptions) => list<AdminUser>("/api/admin/users", params, options),
        get: (id: string, options?: RequestOptions) => get<AdminUser>(`/api/admin/users/${id}`, undefined, options),
        invite: (input: InviteUserInput) => send<AdminUser>("POST", "/api/admin/users/invite", input),
        changeRole: (id: string, role: UserRole) => send<AdminUser>("PATCH", `/api/admin/users/${id}`, { role }),
        update: (id: string, input: UpdateUserInput) => send<AdminUser>("PATCH", `/api/admin/users/${id}`, input),
        suspend: (id: string) => send<AdminUser>("POST", `/api/admin/users/${id}/suspend`),
        reinstate: (id: string) => send<AdminUser>("POST", `/api/admin/users/${id}/reinstate`),
        resetPassword: (id: string) => post(`/api/admin/users/${id}/reset-password`),
        remove: (id: string) => remove(`/api/admin/users/${id}`),
        bulk: (input: BulkUserActionInput) => send<{ affected: number }>("POST", "/api/admin/users/bulk", input),
      },
      organizations: {
        list: (params?: OrganizationListParams, options?: RequestOptions) =>
          list<Organization>("/api/admin/organizations", params, options),
        get: (id: string, options?: RequestOptions) => get<Organization>(`/api/admin/organizations/${id}`, undefined, options),
        create: (input: CreateOrganizationInput) => send<Organization>("POST", "/api/admin/organizations", input),
        update: (id: string, input: UpdateOrganizationInput) => send<Organization>("PATCH", `/api/admin/organizations/${id}`, input),
      },
      auditLog: {
        list: (params?: AuditLogParams, options?: RequestOptions) => list<AuditLogEntry>("/api/admin/audit-log", params, options),
      },
    },
  };
}

export type Api = ReturnType<typeof createApi>;
