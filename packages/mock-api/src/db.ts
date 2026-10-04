import { createSeed, ME_ID, type ProjectRecord, type Seed, type TaskRecord } from "./data/seed";
import type { AuditAction, Comment, Organization, Project, Task, TaskDetail, User, UserSummary } from "@trestle/api-client/types";

export class Db {
  state: Seed = createSeed();
  private counter = 1000;

  reset() {
    this.state = createSeed();
    this.counter = 1000;
  }

  nextId(prefix: string) {
    this.counter += 1;
    return `${prefix}_${this.counter}`;
  }

  /** The next usr_000123 id, from the highest in use so deleting a user never causes a collision. */
  nextUserId() {
    const highest = this.state.users.reduce((max, u) => Math.max(max, Number.parseInt(u.id.replace("usr_", ""), 10) || 0), 0);
    return `usr_${String(highest + 1).padStart(6, "0")}`;
  }

  get me(): User {
    return this.user(ME_ID)!;
  }

  user(id: string) {
    return this.state.users.find((u) => u.id === id);
  }

  summary(id: string | null): UserSummary | null {
    const user = id ? this.user(id) : undefined;
    return user ? { id: user.id, name: user.name, initials: user.initials } : null;
  }

  org(id: string): Organization | undefined {
    const record = this.state.orgs.find((o) => o.id === id);
    if (!record) return undefined;
    const memberCount = this.state.users.filter((u) => u.orgId === id).length;
    return { ...record, memberCount };
  }

  project(record: ProjectRecord): Project {
    const { memberIds, ...rest } = record;
    return {
      ...rest,
      members: memberIds.map((id) => this.summary(id)).filter((m): m is UserSummary => m !== null),
    };
  }

  task(record: TaskRecord): Task {
    const { assigneeId, ...rest } = record;
    return { ...rest, assignee: this.summary(assigneeId) };
  }

  taskDetail(record: TaskRecord): TaskDetail {
    const comments: Comment[] = this.state.comments
      .filter((c) => c.taskId === record.id)
      .map((c) => ({
        id: c.id,
        author: this.summary(c.authorId) ?? { id: c.authorId, name: "Unknown", initials: "?" },
        body: c.body,
        createdAt: c.createdAt,
      }));
    return { ...this.task(record), comments };
  }

  log(action: AuditAction, target: string, actor: string = this.me.email) {
    this.state.audit.unshift({
      id: this.nextId("aud"),
      timestamp: new Date().toISOString(),
      actor,
      action,
      target,
    });
  }
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
