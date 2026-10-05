import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Enum values match the API contract (@trestle/api-client/types) exactly, so rows serialize as they are.
export const userRole = pgEnum("user_role", ["owner", "admin", "member", "viewer"]);
export const userStatus = pgEnum("user_status", ["active", "invited", "suspended"]);
export const orgPlan = pgEnum("org_plan", ["free", "pro", "enterprise"]);
export const orgStatus = pgEnum("org_status", ["active", "trialing", "pastDue"]);
export const projectStatus = pgEnum("project_status", ["active", "planning", "onHold", "archived"]);
export const projectColor = pgEnum("project_color", ["purple", "cyan", "green", "orange", "blue", "pink"]);
export const taskStatus = pgEnum("task_status", ["todo", "inProgress", "inReview", "done"]);
export const taskPriority = pgEnum("task_priority", ["urgent", "high", "medium", "low"]);
export const auditAction = pgEnum("audit_action", [
  "suspend_user",
  "reinstate_user",
  "delete_user",
  "invite_user",
  "update_role",
  "reset_password",
  "create_project",
  "delete_project",
  "create_organization",
  "billing_charge",
  "login_failed",
  "update_user",
  "update_organization",
  "signup",
]);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// Descending indexes say nullsFirst() because that is what `ORDER BY x DESC` means in Postgres; the default
// (NULLS LAST) would not match the queries' sort order and the index could not be used for ordering.
// Trigram (gin_trgm_ops) indexes make `ILIKE '%term%'` search use an index instead of scanning the table.

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    plan: orgPlan("plan").notNull().default("free"),
    status: orgStatus("status").notNull().default("trialing"),
    // The operator's own organization: its admins can manage every organization in the admin panel.
    isPlatform: boolean("is_platform").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("organizations_name_lower_key").on(sql`lower(${t.name})`),
    index("organizations_name_trgm").using("gin", sql`${t.name} gin_trgm_ops`),
    index("organizations_plan_status_idx").on(t.plan, t.status),
    // At most one platform organization.
    uniqueIndex("organizations_single_platform").on(t.isPlatform).where(sql`${t.isPlatform}`),
  ],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    // Null for invited users who have not set a password yet.
    passwordHash: text("password_hash"),
    role: userRole("role").notNull().default("member"),
    status: userStatus("status").notNull().default("active"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("users_email_lower_key").on(sql`lower(${t.email})`),
    index("users_org_idx").on(t.orgId),
    index("users_name_trgm").using("gin", sql`${t.name} gin_trgm_ops`),
    index("users_email_trgm").using("gin", sql`${t.email} gin_trgm_ops`),
    index("users_joined_idx").on(t.joinedAt.desc().nullsFirst()),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    // SHA-256 of the bearer token: a leaked table cannot be replayed.
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId), index("sessions_expires_idx").on(t.expiresAt)],
);

export const passwordResets = pgTable(
  "password_resets",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("password_resets_user_idx").on(t.userId)],
);

export const projects = pgTable(
  "projects",
  {
    // A URL-safe slug derived from the name; it is the public id used in routes.
    id: text("id").primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    color: projectColor("color").notNull().default("purple"),
    status: projectStatus("status").notNull().default("planning"),
    dueDate: date("due_date", { mode: "string" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // Serves "recent projects" and the projects list: filter by org (and status), newest first.
    index("projects_org_updated_idx").on(t.orgId, t.updatedAt.desc().nullsFirst()),
    index("projects_org_status_idx").on(t.orgId, t.status),
    index("projects_name_trgm").using("gin", sql`${t.name} gin_trgm_ops`),
  ],
);

export const projectMembers = pgTable(
  "project_members",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addedAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.userId] }), index("project_members_user_idx").on(t.userId)],
);

export const tasks = pgTable(
  "tasks",
  {
    // Exposed as TASK-<id>.
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: taskStatus("status").notNull().default("todo"),
    priority: taskPriority("priority").notNull().default("medium"),
    assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
    dueDate: date("due_date", { mode: "string" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // Project board and the per-project progress aggregate.
    index("tasks_project_status_idx").on(t.projectId, t.status),
    // "My tasks": by assignee, soonest due first (nulls last), skipping finished work.
    index("tasks_assignee_due_idx")
      .on(t.assigneeId, sql`${t.dueDate} asc nulls last`)
      .where(sql`${t.status} <> 'done'`),
    index("tasks_assignee_idx").on(t.assigneeId),
    index("tasks_title_trgm").using("gin", sql`${t.title} gin_trgm_ops`),
  ],
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("comments_task_created_idx").on(t.taskId, t.createdAt)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // The org the event belongs to, so an org admin only ever sees their own events. Null for system events.
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "set null" }),
    // Email is kept as a snapshot: the trail survives the actor's account being deleted.
    actor: text("actor").notNull(),
    action: auditAction("action").notNull(),
    target: text("target").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_log_created_idx").on(t.createdAt.desc().nullsFirst()),
    index("audit_log_org_created_idx").on(t.orgId, t.createdAt.desc().nullsFirst()),
    index("audit_log_action_created_idx").on(t.action, t.createdAt.desc().nullsFirst()),
    index("audit_log_actor_trgm").using("gin", sql`${t.actor} gin_trgm_ops`),
    index("audit_log_target_trgm").using("gin", sql`${t.target} gin_trgm_ops`),
  ],
);

// Attempt counters for rate limiting, in the database so every API instance shares them and a restart keeps them.
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull(),
    resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("rate_limits_reset_idx").on(t.resetAt)],
);

export const contactMessages = pgTable("contact_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  company: text("company").notNull().default(""),
  message: text("message").notNull(),
  createdAt: createdAt(),
});

export type UserRow = typeof users.$inferSelect;
