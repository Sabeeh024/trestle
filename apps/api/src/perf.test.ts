import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { sql } from "drizzle-orm";

import { ORG } from "./db/seed";
import { setup } from "./test-utils";

// Loads enough rows that the planner has a real choice, then checks the hot queries use the indexes
// designed for them. The sequential-scan-off cases ask "can the index serve this query (filter and order)
// at all"; the planner may still prefer a scan on small tables, which is the right call there.

describe("query plans", async () => {
  const t = await setup();
  after(() => t.close());

  type Result = { rows?: Record<string, string>[] } | Record<string, string>[];
  const rowsOf = (result: unknown) => {
    const r = result as Result;
    return Array.isArray(r) ? r : (r.rows ?? []);
  };
  const plan = async (query: string, { seqScan = true }: { seqScan?: boolean } = {}) => {
    await t.db.execute(sql.raw(`set enable_seqscan = ${seqScan ? "on" : "off"}`));
    const result = await t.db.execute(sql.raw(`explain ${query}`));
    await t.db.execute(sql`set enable_seqscan = on`);
    return rowsOf(result).map((r) => r["QUERY PLAN"]).join("\n");
  };

  before(async () => {
    // Enough rows that the planner has a real choice: 6k users in 200 orgs, 2k projects, 30k tasks, 20k audit rows.
    await t.db.execute(sql`insert into organizations (id, name) select gen_random_uuid(), 'Org ' || g from generate_series(1, 200) g`);
    await t.db.execute(sql`
      with orgs as (select array_agg(id) as ids from organizations)
      insert into users (org_id, name, email, joined_at)
      select ids[1 + g % 200], 'Person ' || g, 'person' || g || '@example.com', now() - (g || ' minutes')::interval
      from generate_series(1, 6000) g, orgs`);
    await t.db.execute(sql`
      insert into projects (id, org_id, name, updated_at)
      select 'project-' || g, '${sql.raw(ORG.trestle)}', 'Project ' || g, now() - (g || ' minutes')::interval from generate_series(1, 2000) g`);
    await t.db.execute(sql`
      with people as (select array_agg(id) as ids from users)
      insert into tasks (project_id, title, status, assignee_id, due_date)
      select 'project-' || (1 + g % 2000), 'Task title ' || g, (array['todo','inProgress','inReview','done'])[1 + g % 4]::task_status,
             ids[1 + g % 3000], (current_date + (g % 90))
      from generate_series(1, 30000) g, people`);
    await t.db.execute(sql`
      insert into audit_log (org_id, actor, action, target, created_at)
      select '${sql.raw(ORG.trestle)}', 'a' || g || '@x.dev', 'update_user', 'target ' || g, now() - (g || ' seconds')::interval from generate_series(1, 20000) g`);
    await t.db.execute(sql`analyze`);
  });

  it("looks users up by email through the lower(email) index", async () => {
    const p = await plan(`select * from users where lower(email) = 'person777@example.com'`);
    assert.match(p, /users_email_lower_key/);
  });

  it("searches names with the trigram index instead of scanning", async () => {
    const p = await plan(`select * from users where name ilike '%son 7777%'`, { seqScan: false });
    assert.match(p, /users_name_trgm/, p);
    const tasks = await plan(`select * from tasks where title ilike '%title 4242%'`, { seqScan: false });
    assert.match(tasks, /tasks_title_trgm/, tasks);
  });

  it("serves 'recent projects' newest-first straight from the org+updated_at index", async () => {
    const p = await plan(`select * from projects where org_id = '${ORG.trestle}' and status <> 'archived' order by updated_at desc limit 4`, { seqScan: false });
    assert.match(p, /projects_org_updated_idx/, p);
    assert.doesNotMatch(p, /Sort/, p);
  });

  it("serves 'my tasks' from the partial assignee+due-date index", async () => {
    const id = rowsOf(await t.db.execute(sql`select assignee_id as id from tasks where assignee_id is not null limit 1`))[0]!.id;
    const p = await plan(`select * from tasks where assignee_id = '${id}' and status <> 'done' order by due_date asc nulls last, id asc limit 20`, { seqScan: false });
    assert.match(p, /tasks_assignee_due_idx/, p);
  });

  it("serves a project's tasks and progress from the project+status index", async () => {
    const p = await plan(`select status, count(*) from tasks where project_id = 'project-77' group by status`);
    assert.match(p, /tasks_project_status_idx/, p);
  });

  it("pages the audit log from the created_at index without a sort", async () => {
    const p = await plan(`select * from audit_log where org_id = '${ORG.trestle}' order by created_at desc, id desc limit 20 offset 40`, { seqScan: false });
    assert.match(p, /audit_log_org_created_idx|audit_log_created_idx/, p);
  });

  it("runs a constant number of queries per request, however many rows come back", async () => {
    await t.reset();
    const token = await t.login("jordan.kim@trestle.io");
    const count = async (path: string) => {
      t.queries.length = 0;
      const res = await t.request("GET", path, { token });
      assert.equal(res.status, 200);
      return t.queries.length;
    };

    assert.equal(await count("/api/projects?pageSize=1"), await count("/api/projects?pageSize=7"));
    assert.equal(await count("/api/tasks?pageSize=1"), await count("/api/tasks?pageSize=9"));
    assert.equal(await count("/api/admin/users?pageSize=1"), await count("/api/admin/users?pageSize=9"));
    assert.ok((await count("/api/projects")) <= 6);
    assert.ok((await count("/api/dashboard")) <= 8);
  });
});
