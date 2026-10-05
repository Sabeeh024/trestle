import { sql } from "drizzle-orm";

import { hashPassword } from "../lib/password";
import { schema, type Db } from "./index";

// Fixed ids keep the seed reproducible, so tests and docs can name the same accounts every time.
const uuid = (kind: number, n: number) => `00000000-0000-4000-${String(kind).padStart(4, "0")}-${String(n).padStart(12, "0")}`;
export const orgId = (n: number) => uuid(1, n);
export const userId = (n: number) => uuid(2, n);

export const ORG = { trestle: orgId(1), northwind: orgId(2), fontaine: orgId(3), umbra: orgId(4), verity: orgId(5), haldane: orgId(6) };
export const USER = {
  alex: userId(1),
  maya: userId(2),
  jordan: userId(3),
  sam: userId(4),
  priya: userId(5),
  tom: userId(6),
  elena: userId(7),
  noah: userId(8),
  jamie: userId(9),
};

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);

/** Removes every row and restarts the task numbering. */
export async function truncateAll(db: Db) {
  await db.execute(
    sql`truncate table contact_messages, audit_log, comments, tasks, project_members, projects, password_resets, sessions, users, organizations restart identity cascade`,
  );
}

/** Loads the demo data. Every account gets `password`. */
export async function seed(db: Db, password: string) {
  const passwordHash = await hashPassword(password);

  await db.transaction(async (tx) => {
    await tx.insert(schema.organizations).values([
      { id: ORG.trestle, name: "Trestle Labs", plan: "enterprise", status: "active", isPlatform: true, createdAt: new Date("2024-08-20T09:00:00Z") },
      { id: ORG.northwind, name: "Northwind", plan: "pro", status: "active", createdAt: new Date("2025-01-12T09:00:00Z") },
      { id: ORG.fontaine, name: "Fontaine Co.", plan: "pro", status: "active", createdAt: new Date("2025-03-02T09:00:00Z") },
      { id: ORG.umbra, name: "Umbra Labs", plan: "free", status: "trialing", createdAt: new Date("2026-09-19T09:00:00Z") },
      { id: ORG.verity, name: "Verity", plan: "pro", status: "active", createdAt: new Date("2025-02-08T09:00:00Z") },
      { id: ORG.haldane, name: "Haldane", plan: "free", status: "pastDue", createdAt: new Date("2024-11-30T09:00:00Z") },
    ]);

    // Invited users have not chosen a password yet, so they cannot sign in.
    const account = (id: string, org: string, name: string, email: string, role: "owner" | "admin" | "member" | "viewer", status: "active" | "invited" | "suspended", joinedAt: string, lastActiveAt: Date | null) => ({
      id,
      orgId: org,
      name,
      email,
      role,
      status,
      passwordHash: status === "invited" ? null : passwordHash,
      joinedAt: new Date(joinedAt),
      lastActiveAt,
    });
    await tx.insert(schema.users).values([
      account(USER.alex, ORG.northwind, "Alex Kim", "alex.kim@northwind.io", "admin", "active", "2025-01-14T09:00:00Z", hoursAgo(2)),
      account(USER.maya, ORG.fontaine, "Maya Patel", "maya@fontaineco.com", "member", "active", "2025-03-02T09:00:00Z", hoursAgo(0.2)),
      account(USER.jordan, ORG.trestle, "Jordan Kim", "jordan.kim@trestle.io", "owner", "active", "2024-08-20T09:00:00Z", hoursAgo(0)),
      account(USER.sam, ORG.umbra, "Sam Rivera", "sam.r@umbralabs.dev", "member", "invited", "2026-09-19T09:00:00Z", null),
      account(USER.priya, ORG.verity, "Priya Nair", "priya@verity.app", "admin", "active", "2025-02-08T09:00:00Z", hoursAgo(24)),
      account(USER.tom, ORG.haldane, "Tom Baker", "tom.baker@haldane.co", "member", "suspended", "2024-11-30T09:00:00Z", hoursAgo(504)),
      account(USER.elena, ORG.northwind, "Elena Cho", "elena.cho@northwind.io", "member", "active", "2025-04-17T09:00:00Z", hoursAgo(4)),
      account(USER.noah, ORG.fontaine, "Noah Williams", "noah@fontaineco.com", "viewer", "invited", "2026-09-21T09:00:00Z", null),
      account(USER.jamie, ORG.trestle, "Jamie Singh", "jamie.singh@trestle.io", "member", "active", "2025-05-06T09:00:00Z", hoursAgo(6)),
    ]);

    // The demo workspace is Trestle Labs, whose members are Jordan and Jamie. Other organizations have
    // their own (empty) workspaces, so tenant isolation is visible straight away.
    const project = (id: string, name: string, description: string, color: typeof schema.projectColor.enumValues[number], status: typeof schema.projectStatus.enumValues[number], dueDate: string | null, updated: number, org: string = ORG.trestle) => ({
      id,
      orgId: org,
      name,
      description,
      color,
      status,
      dueDate,
      createdAt: hoursAgo(updated + 500),
      updatedAt: hoursAgo(updated),
    });
    await tx.insert(schema.projects).values([
      project("website-redesign", "Website Redesign", "Homepage, pricing, and blog templates", "purple", "active", "2026-10-10", 2),
      project("mobile-app-v2", "Mobile App v2", "Native app redesign for iOS/Android", "cyan", "active", "2026-11-02", 5),
      project("q3-marketing-campaign", "Q3 Marketing Campaign", "Launch campaign for Q3 product push", "green", "active", "2026-09-28", 24),
      project("api-migration", "API Migration", "Migrating auth to new identity provider", "orange", "active", "2026-12-15", 72),
      project("design-system-audit", "Design System Audit", "Review component coverage and gaps", "blue", "planning", "2026-11-20", 144),
      project("holiday-campaign-2025", "Holiday Campaign 2025", "Seasonal promotion, wrapped up last year", "orange", "archived", "2025-12-24", 2400),
      project("customer-portal", "Customer Portal", "Self-serve billing and support portal", "pink", "onHold", null, 336),
      // The other organizations have workspaces of their own, which the Trestle accounts never see.
      project("northwind-checkout", "Checkout Revamp", "Faster, simpler checkout for the storefront", "blue", "active", "2026-11-14", 8, ORG.northwind),
      project("northwind-loyalty", "Loyalty Program", "Points and tiers for returning customers", "green", "planning", "2027-01-31", 60, ORG.northwind),
      project("fontaine-rebrand", "Fontaine Rebrand", "New identity, packaging and site", "pink", "active", "2026-12-05", 12, ORG.fontaine),
      project("verity-audit", "Security Audit", "Annual third-party penetration test", "orange", "active", "2026-10-30", 30, ORG.verity),
    ]);

    await tx.insert(schema.projectMembers).values([
      { projectId: "website-redesign", userId: USER.jordan },
      { projectId: "website-redesign", userId: USER.jamie },
      { projectId: "mobile-app-v2", userId: USER.jordan },
      { projectId: "q3-marketing-campaign", userId: USER.jamie },
      { projectId: "api-migration", userId: USER.jordan },
      { projectId: "design-system-audit", userId: USER.jordan },
      { projectId: "holiday-campaign-2025", userId: USER.jamie },
      { projectId: "customer-portal", userId: USER.jamie },
      { projectId: "northwind-checkout", userId: USER.alex },
      { projectId: "northwind-checkout", userId: USER.elena },
      { projectId: "northwind-loyalty", userId: USER.alex },
      { projectId: "fontaine-rebrand", userId: USER.maya },
      { projectId: "verity-audit", userId: USER.priya },
    ]);

    const task = (id: number, projectId: string, title: string, priority: "urgent" | "high" | "medium" | "low", status: "todo" | "inProgress" | "inReview" | "done", assigneeId: string | null, dueDate: string | null, description = "") => ({
      id,
      projectId,
      title,
      description,
      priority,
      status,
      assigneeId,
      dueDate,
      createdAt: hoursAgo(200),
      updatedAt: hoursAgo(3),
    });
    await tx.insert(schema.tasks).values([
      task(104, "website-redesign", "Fix login bug on Safari", "urgent", "todo", USER.jamie, "2026-09-23", "Safari on iOS silently fails the login POST request when third-party cookies are blocked. Reproduce with Safari 17 + private browsing."),
      task(87, "website-redesign", "Write Q3 campaign brief", "medium", "todo", USER.jordan, "2026-09-30"),
      task(98, "website-redesign", "Redesign onboarding flow", "high", "inProgress", USER.jamie, "2026-09-25"),
      task(121, "website-redesign", "Build responsive nav", "medium", "inProgress", USER.jamie, "2026-10-05"),
      task(73, "website-redesign", "Review PR #482", "low", "inReview", USER.jordan, "2026-09-24"),
      task(56, "website-redesign", "Set up design tokens", "low", "done", USER.jordan, null),
      task(112, "api-migration", "Migrate auth service", "high", "inProgress", USER.jordan, "2026-10-02"),
      task(130, "mobile-app-v2", "Draft mobile onboarding screens", "medium", "todo", USER.jordan, "2026-10-12"),
      task(131, "design-system-audit", "Audit button variants", "low", "todo", USER.jordan, "2026-11-01"),
      task(201, "northwind-checkout", "Add Apple Pay", "high", "inProgress", USER.elena, "2026-10-20", "Wallet button on the payment step, behind a feature flag."),
      task(202, "northwind-checkout", "Cut checkout to two steps", "medium", "todo", USER.alex, "2026-11-01"),
      task(203, "northwind-checkout", "Fix coupon rounding", "urgent", "inReview", USER.elena, "2026-10-08"),
      task(204, "northwind-loyalty", "Define point tiers", "low", "todo", USER.alex, null),
      task(211, "fontaine-rebrand", "Shortlist logo directions", "medium", "inProgress", USER.maya, "2026-10-18"),
      task(212, "fontaine-rebrand", "Brief the packaging printer", "low", "todo", USER.maya, "2026-11-10"),
      task(221, "verity-audit", "Scope the penetration test", "high", "done", USER.priya, null),
      task(222, "verity-audit", "Review the findings report", "high", "todo", USER.priya, "2026-10-30"),
    ]);
    // Explicit ids bypass the identity counter, so move it past them.
    await tx.execute(sql`select setval(pg_get_serial_sequence('tasks', 'id'), (select max(id) from tasks))`);

    await tx.insert(schema.comments).values([
      { taskId: 104, authorId: USER.jordan, body: "Can repro on iOS 17.2. Looks like it's the SameSite=Strict cookie flag.", createdAt: hoursAgo(2) },
      { taskId: 104, authorId: USER.jamie, body: "Switching to SameSite=Lax for the auth cookie now, will push a fix shortly.", createdAt: hoursAgo(0.75) },
      { taskId: 203, authorId: USER.alex, body: "Off by one cent on 3-for-2 offers. Test added, fix is in review.", createdAt: hoursAgo(5) },
    ]);

    const event = (org: string | null, actor: string, action: (typeof schema.auditAction.enumValues)[number], target: string, at: string) => ({
      orgId: org,
      actor,
      action,
      target,
      createdAt: new Date(at),
    });
    await tx.insert(schema.auditLog).values([
      event(ORG.haldane, "jordan.kim@trestle.io", "suspend_user", "tom.baker@haldane.co", "2026-09-23T14:02:11Z"),
      event(ORG.northwind, "alex.kim@northwind.io", "create_project", "Website Redesign", "2026-09-23T11:47:03Z"),
      event(ORG.fontaine, "system", "billing_charge", "Fontaine Co. — $108.00", "2026-09-22T19:15:40Z"),
      event(ORG.fontaine, "maya@fontaineco.com", "invite_user", "noah@fontaineco.com", "2026-09-22T16:30:12Z"),
      event(ORG.trestle, "jordan.kim@trestle.io", "delete_project", "Legacy Migration", "2026-09-22T09:05:57Z"),
      event(ORG.umbra, "priya@verity.app", "update_role", "sam.r@umbralabs.dev → Member", "2026-09-21T22:41:19Z"),
      event(null, "system", "login_failed", "unknown@haldane.co", "2026-09-21T13:12:05Z"),
      event(ORG.umbra, "jordan.kim@trestle.io", "create_organization", "Umbra Labs", "2026-09-20T08:58:44Z"),
    ]);
  });
}
