import type { AxiosInstance } from "axios";

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
  TaskListParams,
  UpdateProjectInput,
  UpdateTaskInput,
  User,
  UserListParams,
  UserRole,
} from "./types";

export interface RequestOptions {
  signal?: AbortSignal | undefined;
}

type Envelope<T> = { data: T };

export function createApi(client: AxiosInstance) {
  const get = async <T>(url: string, params?: object, options?: RequestOptions) =>
    (await client.get<Envelope<T>>(url, { params, signal: options?.signal })).data.data;

  const list = async <T>(url: string, params?: object, options?: RequestOptions) =>
    (await client.get<Paginated<T>>(url, { params, signal: options?.signal })).data;

  const send = async <T>(method: "post" | "patch", url: string, body?: object) =>
    (await client.request<Envelope<T>>({ method, url, data: body })).data.data;

  const remove = async (url: string) => {
    await client.delete(url);
  };

  const post = async (url: string) => {
    await client.post(url);
  };

  return {
    auth: {
      login: (input: LoginInput) => send<LoginResult>("post", "/api/auth/login", input),
      me: (options?: RequestOptions) => get<User>("/api/auth/me", undefined, options),
      logout: () => post("/api/auth/logout"),
    },

    dashboard: {
      get: (options?: RequestOptions) => get<DashboardData>("/api/dashboard", undefined, options),
    },

    projects: {
      list: (params?: ProjectListParams, options?: RequestOptions) => list<Project>("/api/projects", params, options),
      get: (id: string, options?: RequestOptions) => get<Project>(`/api/projects/${id}`, undefined, options),
      create: (input: CreateProjectInput) => send<Project>("post", "/api/projects", input),
      update: (id: string, input: UpdateProjectInput) => send<Project>("patch", `/api/projects/${id}`, input),
      remove: (id: string) => remove(`/api/projects/${id}`),
      tasks: (id: string, params?: { page?: number; pageSize?: number }, options?: RequestOptions) =>
        list<Task>(`/api/projects/${id}/tasks`, params, options),
    },

    tasks: {
      list: (params?: TaskListParams, options?: RequestOptions) => list<Task>("/api/tasks", params, options),
      get: (id: string, options?: RequestOptions) => get<TaskDetail>(`/api/tasks/${id}`, undefined, options),
      create: (input: CreateTaskInput) => send<TaskDetail>("post", "/api/tasks", input),
      update: (id: string, input: UpdateTaskInput) => send<TaskDetail>("patch", `/api/tasks/${id}`, input),
      remove: (id: string) => remove(`/api/tasks/${id}`),
      addComment: (id: string, body: string) => send<Comment>("post", `/api/tasks/${id}/comments`, { body }),
    },

    admin: {
      users: {
        list: (params?: UserListParams, options?: RequestOptions) => list<AdminUser>("/api/admin/users", params, options),
        get: (id: string, options?: RequestOptions) => get<AdminUser>(`/api/admin/users/${id}`, undefined, options),
        invite: (input: InviteUserInput) => send<AdminUser>("post", "/api/admin/users/invite", input),
        changeRole: (id: string, role: UserRole) => send<AdminUser>("patch", `/api/admin/users/${id}`, { role }),
        suspend: (id: string) => send<AdminUser>("post", `/api/admin/users/${id}/suspend`),
        reinstate: (id: string) => send<AdminUser>("post", `/api/admin/users/${id}/reinstate`),
        resetPassword: (id: string) => post(`/api/admin/users/${id}/reset-password`),
        remove: (id: string) => remove(`/api/admin/users/${id}`),
        bulk: (input: BulkUserActionInput) => send<{ affected: number }>("post", "/api/admin/users/bulk", input),
      },
      organizations: {
        list: (params?: OrganizationListParams, options?: RequestOptions) =>
          list<Organization>("/api/admin/organizations", params, options),
        get: (id: string, options?: RequestOptions) => get<Organization>(`/api/admin/organizations/${id}`, undefined, options),
        create: (input: CreateOrganizationInput) => send<Organization>("post", "/api/admin/organizations", input),
      },
      auditLog: {
        list: (params?: AuditLogParams, options?: RequestOptions) => list<AuditLogEntry>("/api/admin/audit-log", params, options),
      },
    },
  };
}

export type Api = ReturnType<typeof createApi>;
