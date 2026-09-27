// Placeholder content for the app shell screens. Names, task titles and
// comments are mock product data (like real user content would be), not
// translated UI chrome — only the surrounding labels go through i18n.

export type CategoricalColor = "purple" | "cyan" | "green" | "orange" | "blue" | "pink";
export type ProjectStatus = "active" | "planning" | "onHold";
export type TaskStatus = "todo" | "inProgress" | "inReview" | "done";
export type Priority = "urgent" | "high" | "medium" | "low";

export interface Project {
  id: string;
  name: string;
  description: string;
  color: CategoricalColor;
  progress: number;
  members: string[];
  due: string | null;
  updatedAgo: string;
  status: ProjectStatus;
}

export const projects: Project[] = [
  {
    id: "website-redesign",
    name: "Website Redesign",
    description: "Homepage, pricing, and blog templates",
    color: "purple",
    progress: 72,
    members: ["AK", "MP", "JS"],
    due: "Oct 10",
    updatedAgo: "2h",
    status: "active",
  },
  {
    id: "mobile-app-v2",
    name: "Mobile App v2",
    description: "Native app redesign for iOS/Android",
    color: "cyan",
    progress: 45,
    members: ["MP", "JK"],
    due: "Nov 2",
    updatedAgo: "5h",
    status: "active",
  },
  {
    id: "q3-marketing-campaign",
    name: "Q3 Marketing Campaign",
    description: "Launch campaign for Q3 product push",
    color: "green",
    progress: 90,
    members: ["JS"],
    due: "Sep 28",
    updatedAgo: "1d",
    status: "active",
  },
  {
    id: "api-migration",
    name: "API Migration",
    description: "Migrating auth to new identity provider",
    color: "orange",
    progress: 30,
    members: ["AK", "JK"],
    due: "Dec 15",
    updatedAgo: "3d",
    status: "active",
  },
  {
    id: "design-system-audit",
    name: "Design System Audit",
    description: "Review component coverage and gaps",
    color: "blue",
    progress: 5,
    members: ["JK"],
    due: "Nov 20",
    updatedAgo: "6d",
    status: "planning",
  },
  {
    id: "customer-portal",
    name: "Customer Portal",
    description: "Self-serve billing and support portal",
    color: "pink",
    progress: 55,
    members: ["MP"],
    due: null,
    updatedAgo: "2w",
    status: "onHold",
  },
];

export interface DashboardTask {
  id: string;
  title: string;
  projectId: string;
  priority: Priority;
  due: string;
  status: TaskStatus;
}

export const dashboardTasks: DashboardTask[] = [
  { id: "TASK-104", title: "Fix login bug on Safari", projectId: "mobile-app-v2", priority: "urgent", due: "Sep 23", status: "todo" },
  { id: "TASK-98", title: "Redesign onboarding flow", projectId: "website-redesign", priority: "high", due: "Sep 25", status: "inProgress" },
  { id: "TASK-112", title: "Migrate auth service", projectId: "api-migration", priority: "high", due: "Oct 2", status: "inProgress" },
  { id: "TASK-87", title: "Write Q3 campaign brief", projectId: "q3-marketing-campaign", priority: "medium", due: "Sep 30", status: "todo" },
  { id: "TASK-73", title: "Review PR #482", projectId: "mobile-app-v2", priority: "low", due: "Sep 24", status: "done" },
];

export interface BoardTask {
  id: string;
  title: string;
  priority: Priority;
  assigneeInitials: string;
  status: TaskStatus;
}

export const websiteRedesignTasks: BoardTask[] = [
  { id: "TASK-104", title: "Fix login bug on Safari", priority: "urgent", assigneeInitials: "MP", status: "todo" },
  { id: "TASK-87", title: "Write Q3 campaign brief", priority: "medium", assigneeInitials: "JK", status: "todo" },
  { id: "TASK-98", title: "Redesign onboarding flow", priority: "high", assigneeInitials: "AK", status: "inProgress" },
  { id: "TASK-121", title: "Build responsive nav", priority: "medium", assigneeInitials: "MP", status: "inProgress" },
  { id: "TASK-73", title: "Review PR #482", priority: "low", assigneeInitials: "JS", status: "inReview" },
  { id: "TASK-56", title: "Set up design tokens", priority: "low", assigneeInitials: "JK", status: "done" },
];

export const taskDetail = {
  id: "TASK-104",
  title: "Fix login bug on Safari",
  status: "todo" as TaskStatus,
  assignee: "Maya Patel",
  assigneeInitials: "MP",
  priority: "urgent" as Priority,
  dueDate: "Sep 23, 2026",
  description:
    "Safari on iOS silently fails the login POST request when third-party cookies are blocked. Reproduce with Safari 17 + private browsing.",
  comments: [
    { author: "Alex Kim", initials: "AK", time: "2h ago", body: "Can repro on iOS 17.2. Looks like it's the SameSite=Strict cookie flag." },
    { author: "Maya Patel", initials: "MP", time: "45m ago", body: "Switching to SameSite=Lax for the auth cookie now, will push a fix shortly." },
  ],
};

export const currentUser = { name: "Jordan Kim", initials: "JK", role: "Product Designer" };
