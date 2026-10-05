import type {
  AuditLogParams,
  OrganizationListParams,
  ProjectListParams,
  TaskListParams,
  UserListParams,
} from "../types";

// Hierarchical keys: invalidating ["projects"] also refreshes every project list and detail.
export const queryKeys = {
  me: ["me"] as const,
  dashboard: ["dashboard"] as const,
  sessions: ["sessions"] as const,
  projects: {
    all: ["projects"] as const,
    list: (params?: ProjectListParams) => ["projects", "list", params ?? {}] as const,
    detail: (id: string) => ["projects", "detail", id] as const,
    tasks: (id: string) => ["projects", "detail", id, "tasks"] as const,
  },
  tasks: {
    all: ["tasks"] as const,
    list: (params?: TaskListParams) => ["tasks", "list", params ?? {}] as const,
    detail: (id: string) => ["tasks", "detail", id] as const,
  },
  admin: {
    users: {
      all: ["admin", "users"] as const,
      list: (params?: UserListParams) => ["admin", "users", "list", params ?? {}] as const,
      detail: (id: string) => ["admin", "users", "detail", id] as const,
    },
    organizations: {
      all: ["admin", "organizations"] as const,
      list: (params?: OrganizationListParams) => ["admin", "organizations", "list", params ?? {}] as const,
      detail: (id: string) => ["admin", "organizations", "detail", id] as const,
    },
    auditLog: {
      all: ["admin", "audit-log"] as const,
      list: (params?: AuditLogParams) => ["admin", "audit-log", "list", params ?? {}] as const,
    },
  },
};
