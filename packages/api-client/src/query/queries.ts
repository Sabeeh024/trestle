import { queryOptions } from "@tanstack/react-query";

import type { Api } from "../api";
import type {
  AuditLogParams,
  OrganizationListParams,
  ProjectListParams,
  TaskListParams,
  UserListParams,
} from "../types";
import { queryKeys } from "./keys";

// Query options are plain objects, so the same definition works for useQuery in a client
// component and for queryClient.prefetchQuery in a Next Server Component.
export function createQueries(api: Api) {
  return {
    me: () => queryOptions({ queryKey: queryKeys.me, queryFn: ({ signal }) => api.auth.me({ signal }) }),
    dashboard: () => queryOptions({ queryKey: queryKeys.dashboard, queryFn: ({ signal }) => api.dashboard.get({ signal }) }),
    projects: {
      list: (params?: ProjectListParams) =>
        queryOptions({ queryKey: queryKeys.projects.list(params), queryFn: ({ signal }) => api.projects.list(params, { signal }) }),
      detail: (id: string) =>
        queryOptions({ queryKey: queryKeys.projects.detail(id), queryFn: ({ signal }) => api.projects.get(id, { signal }) }),
      tasks: (id: string) =>
        queryOptions({ queryKey: queryKeys.projects.tasks(id), queryFn: ({ signal }) => api.projects.tasks(id, { pageSize: 100 }, { signal }) }),
    },
    tasks: {
      list: (params?: TaskListParams) =>
        queryOptions({ queryKey: queryKeys.tasks.list(params), queryFn: ({ signal }) => api.tasks.list(params, { signal }) }),
      detail: (id: string) =>
        queryOptions({ queryKey: queryKeys.tasks.detail(id), queryFn: ({ signal }) => api.tasks.get(id, { signal }) }),
    },
    admin: {
      users: {
        list: (params?: UserListParams) =>
          queryOptions({ queryKey: queryKeys.admin.users.list(params), queryFn: ({ signal }) => api.admin.users.list(params, { signal }) }),
        detail: (id: string) =>
          queryOptions({ queryKey: queryKeys.admin.users.detail(id), queryFn: ({ signal }) => api.admin.users.get(id, { signal }) }),
      },
      organizations: {
        list: (params?: OrganizationListParams) =>
          queryOptions({
            queryKey: queryKeys.admin.organizations.list(params),
            queryFn: ({ signal }) => api.admin.organizations.list(params, { signal }),
          }),
        detail: (id: string) =>
          queryOptions({
            queryKey: queryKeys.admin.organizations.detail(id),
            queryFn: ({ signal }) => api.admin.organizations.get(id, { signal }),
          }),
      },
      auditLog: {
        list: (params?: AuditLogParams) =>
          queryOptions({ queryKey: queryKeys.admin.auditLog.list(params), queryFn: ({ signal }) => api.admin.auditLog.list(params, { signal }) }),
      },
    },
  };
}

export type Queries = ReturnType<typeof createQueries>;
