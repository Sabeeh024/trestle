"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "../query/keys";
import type {
  AuditLogParams,
  BulkUserActionInput,
  CreateOrganizationInput,
  CreateProjectInput,
  CreateTaskInput,
  InviteUserInput,
  LoginInput,
  OrganizationListParams,
  UpdateOrganizationInput,
  UpdateProfileInput,
  UpdateProjectInput,
  UpdateTaskInput,
  UpdateUserInput,
  UserListParams,
  UserRole,
} from "../types";
import { useApi } from "./provider";

// ---- Queries ----

export function useMe() {
  return useQuery(useApi().queries.me());
}

export function useProjectTasks(id: string) {
  return useQuery(useApi().queries.projects.tasks(id));
}

export function useTask(id: string | null) {
  const { queries } = useApi();
  return useQuery({ ...queries.tasks.detail(id ?? ""), enabled: id !== null });
}

// Lists keep the previous page on screen while the next one loads, so paging does not flash empty.
export function useAdminUsers(params?: UserListParams) {
  return useQuery({ ...useApi().queries.admin.users.list(params), placeholderData: keepPreviousData });
}

export function useAdminUser(id: string | null) {
  const { queries } = useApi();
  return useQuery({ ...queries.admin.users.detail(id ?? ""), enabled: id !== null });
}

export function useAdminOrganizations(params?: OrganizationListParams) {
  return useQuery({ ...useApi().queries.admin.organizations.list(params), placeholderData: keepPreviousData });
}

export function useAuditLog(params?: AuditLogParams) {
  return useQuery({ ...useApi().queries.admin.auditLog.list(params), placeholderData: keepPreviousData });
}

// ---- Mutations ----

export function useLogin() {
  const { api } = useApi();
  return useMutation({ mutationFn: (input: LoginInput) => api.auth.login(input) });
}

export function useUpdateProfile() {
  const { api } = useApi();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => api.auth.updateProfile(input),
    onSuccess: () => invalidate(queryKeys.me, queryKeys.dashboard),
  });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  return (...keys: (readonly unknown[])[]) => Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

export function useCreateProject() {
  const { api } = useApi();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => api.projects.create(input),
    onSuccess: () => invalidate(queryKeys.projects.all, queryKeys.dashboard, queryKeys.admin.auditLog.all),
  });
}

export function useUpdateProject() {
  const { api } = useApi();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateProjectInput & { id: string }) => api.projects.update(id, input),
    onSuccess: () => invalidate(queryKeys.projects.all, queryKeys.dashboard),
  });
}

export function useCreateTask() {
  const { api } = useApi();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => api.tasks.create(input),
    onSuccess: () => invalidate(queryKeys.tasks.all, queryKeys.projects.all, queryKeys.dashboard),
  });
}

export function useUpdateTask() {
  const { api } = useApi();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateTaskInput & { id: string }) => api.tasks.update(id, input),
    onSuccess: () => invalidate(queryKeys.tasks.all, queryKeys.projects.all, queryKeys.dashboard),
  });
}

export function useAddComment() {
  const { api } = useApi();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ taskId, body }: { taskId: string; body: string }) => api.tasks.addComment(taskId, body),
    onSuccess: (_comment, { taskId }) => invalidate(queryKeys.tasks.detail(taskId)),
  });
}

// Admin actions all write an audit entry, so each one also refreshes the audit log.
function useAdminMutation<TInput, TOutput>(mutationFn: (input: TInput) => Promise<TOutput>, ...extraKeys: (readonly unknown[])[]) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn,
    onSuccess: () => invalidate(queryKeys.admin.users.all, queryKeys.admin.auditLog.all, ...extraKeys),
  });
}

export function useInviteUser() {
  const { api } = useApi();
  return useAdminMutation((input: InviteUserInput) => api.admin.users.invite(input), queryKeys.admin.organizations.all);
}

export function useUpdateUser() {
  const { api } = useApi();
  return useAdminMutation(({ id, ...input }: UpdateUserInput & { id: string }) => api.admin.users.update(id, input));
}

export function useChangeUserRole() {
  const { api } = useApi();
  return useAdminMutation(({ id, role }: { id: string; role: UserRole }) => api.admin.users.changeRole(id, role));
}

export function useSuspendUser() {
  const { api } = useApi();
  return useAdminMutation((id: string) => api.admin.users.suspend(id));
}

export function useReinstateUser() {
  const { api } = useApi();
  return useAdminMutation((id: string) => api.admin.users.reinstate(id));
}

export function useResetUserPassword() {
  const { api } = useApi();
  return useAdminMutation((id: string) => api.admin.users.resetPassword(id));
}

export function useDeleteUser() {
  const { api } = useApi();
  return useAdminMutation((id: string) => api.admin.users.remove(id), queryKeys.admin.organizations.all);
}

export function useBulkUserAction() {
  const { api } = useApi();
  return useAdminMutation((input: BulkUserActionInput) => api.admin.users.bulk(input), queryKeys.admin.organizations.all);
}

export function useUpdateOrganization() {
  const { api } = useApi();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateOrganizationInput & { id: string }) => api.admin.organizations.update(id, input),
    onSuccess: () => invalidate(queryKeys.admin.organizations.all, queryKeys.admin.users.all),
  });
}

export function useCreateOrganization() {
  const { api } = useApi();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: CreateOrganizationInput) => api.admin.organizations.create(input),
    onSuccess: () => invalidate(queryKeys.admin.organizations.all, queryKeys.admin.auditLog.all),
  });
}
