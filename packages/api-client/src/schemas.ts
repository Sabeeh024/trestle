import { z } from "zod";

import type {
  CreateOrganizationInput,
  CreateProjectInput,
  CreateTaskInput,
  ForgotPasswordInput,
  InviteUserInput,
  LoginInput,
  OrgPlan,
  Priority,
  SignupInput,
  SsoInput,
  TaskStatus,
  UpdateOrganizationInput,
  UpdateProfileInput,
  UpdateUserInput,
  UserRole,
} from "./types";

// Request schemas shared by the apps (client-side validation) and the mock server (so the two can
// never disagree). Messages are keys into the `validation` namespace of @trestle/i18n, not prose,
// so each app translates them in its own locale.

export const msg = {
  required: "required",
  emailInvalid: "emailInvalid",
  tooLong: "tooLong",
  dateInvalid: "dateInvalid",
  invalidChoice: "invalidChoice",
  passwordTooShort: "passwordTooShort",
  emailTaken: "emailTaken",
} as const;

export type ValidationKey = (typeof msg)[keyof typeof msg];

export const isValidationKey = (value: unknown): value is ValidationKey =>
  typeof value === "string" && (Object.values(msg) as string[]).includes(value);

const requiredText = (max: number) => z.string().trim().min(1, msg.required).max(max, msg.tooLong);
const optionalText = (max: number) => z.string().trim().max(max, msg.tooLong).optional();
const email = z.string().trim().min(1, msg.required).email(msg.emailInvalid);
// An empty string means "not set", which is what an untouched date input submits.
const optionalDate = z
  .string()
  .refine((value) => value === "" || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))), msg.dateInvalid)
  .optional();

const roles = ["owner", "admin", "member", "viewer"] as const satisfies readonly UserRole[];
const plans = ["free", "pro", "enterprise"] as const satisfies readonly OrgPlan[];
const priorities = ["urgent", "high", "medium", "low"] as const satisfies readonly Priority[];
const taskStatuses = ["todo", "inProgress", "inReview", "done"] as const satisfies readonly TaskStatus[];

export const loginSchema = z.object({
  email,
  password: z.string().min(1, msg.required),
});

export const signupSchema = z.object({
  name: requiredText(80),
  email,
  password: z.string().min(8, msg.passwordTooShort).max(128, msg.tooLong),
});

export const forgotPasswordSchema = z.object({ email });

export const ssoSchema = z.object({ email });

export const updateProfileSchema = z.object({
  name: requiredText(80),
  email,
});

export const updateUserSchema = z.object({
  name: requiredText(80).optional(),
  email: email.optional(),
  role: z.enum(roles, { error: msg.invalidChoice }).optional(),
});

export const updateOrganizationSchema = z.object({
  name: requiredText(80),
  plan: z.enum(plans, { error: msg.invalidChoice }).optional(),
});

export const createProjectSchema = z.object({
  name: requiredText(80),
  description: optionalText(500),
  dueDate: optionalDate,
});

export const createTaskSchema = z.object({
  projectId: z.string().min(1, msg.required),
  title: requiredText(120),
  description: optionalText(2000),
  priority: z.enum(priorities, { error: msg.invalidChoice }).optional(),
  status: z.enum(taskStatuses, { error: msg.invalidChoice }).optional(),
  dueDate: optionalDate,
});

export const commentSchema = z.object({
  body: requiredText(2000),
});

export const inviteUserSchema = z.object({
  email,
  name: optionalText(80),
  orgId: z.string().min(1, msg.required),
  role: z.enum(roles, { error: msg.invalidChoice }).optional(),
});

export const changeRoleSchema = z.object({
  role: z.enum(roles, { error: msg.invalidChoice }),
});

export const createOrganizationSchema = z.object({
  name: requiredText(80),
  plan: z.enum(plans, { error: msg.invalidChoice }).optional(),
});

// Compile-time guard: every value a schema accepts must also be accepted by the matching endpoint type.
type Assert<T extends true> = T;
export type SchemaMatchesEndpointTypes = [
  Assert<z.infer<typeof loginSchema> extends LoginInput ? true : false>,
  Assert<z.infer<typeof createProjectSchema> extends CreateProjectInput ? true : false>,
  Assert<z.infer<typeof createTaskSchema> extends CreateTaskInput ? true : false>,
  Assert<z.infer<typeof inviteUserSchema> extends InviteUserInput ? true : false>,
  Assert<z.infer<typeof createOrganizationSchema> extends CreateOrganizationInput ? true : false>,
  Assert<z.infer<typeof signupSchema> extends SignupInput ? true : false>,
  Assert<z.infer<typeof forgotPasswordSchema> extends ForgotPasswordInput ? true : false>,
  Assert<z.infer<typeof ssoSchema> extends SsoInput ? true : false>,
  Assert<z.infer<typeof updateProfileSchema> extends UpdateProfileInput ? true : false>,
  Assert<z.infer<typeof updateUserSchema> extends UpdateUserInput ? true : false>,
  Assert<z.infer<typeof updateOrganizationSchema> extends UpdateOrganizationInput ? true : false>,
];

/** Flattens a failed parse into `{ field: messageKey }`, keeping the first message per field. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path.join(".");
    if (field && !(field in fields)) fields[field] = issue.message;
  }
  return fields;
}

export type { z };
