import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";

import { EMAIL, setup, tokenFromMail } from "./test-utils";

type Row = Record<string, string>;

describe("admin", async () => {
  const t = await setup();
  beforeEach(() => t.reset());
  after(() => t.close());

  const platform = () => t.login(EMAIL.jordan); // owner of the platform organization
  const orgAdmin = () => t.login(EMAIL.alex); // admin of Northwind only
  const as = (token: string) => ({ token });

  const userId = async (token: string, q: string) => (await t.call("adminUsers", { q }, as(token))).data.data[0].id as string;
  const orgId = async (token: string, q: string) => (await t.call("adminOrganizations", { q }, as(token))).data.data[0].id as string;
  const update = (token: string, id: string, input: object) => t.call("updateUser", { id, input }, as(token));

  it("is only for owners and admins", async () => {
    assert.equal((await t.call("adminUsers")).status, 401);
    const member = await t.login(EMAIL.maya);
    const res = await t.call("adminUsers", {}, as(member));
    assert.equal(res.status, 403);
    assert.equal(res.error?.code, "forbidden");
    // Every admin operation, not just the list.
    assert.equal((await t.call("auditLog", {}, as(member))).status, 403);
    assert.equal((await t.call("createOrganization", { input: { name: "Nope" } }, as(member))).status, 403);
    assert.equal((await t.call("bulkUserAction", { action: "delete", ids: ["00000000-0000-4000-0002-000000009999"] }, as(member))).status, 403);
  });

  describe("users", () => {
    it("lists every user for platform admins, with their organization's name", async () => {
      const res = await t.call("adminUsers", {}, as(await platform()));
      assert.equal(res.data.meta.total, 9);
      const jordan = res.data.data.find((u: Row) => u.email === EMAIL.jordan);
      assert.equal(jordan.orgName, "Trestle Labs");
      assert.equal(jordan.status, "active");
      assert.equal("passwordHash" in jordan, false);
    });

    it("filters, searches and sorts case-insensitively in both directions", async () => {
      const token = await platform();
      assert.equal((await t.call("adminUsers", { role: "admin" }, as(token))).data.meta.total, 2);
      assert.equal((await t.call("adminUsers", { status: "invited" }, as(token))).data.meta.total, 2);
      assert.equal((await t.call("adminUsers", { q: "NORTHWIND" }, as(token))).data.meta.total, 2);

      const asc = (await t.call("adminUsers", { sort: "name" }, as(token))).data.data.map((u: Row) => u.name);
      assert.deepEqual(asc, [...asc].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
      const desc = (await t.call("adminUsers", { sort: "email", direction: "desc" }, as(token))).data.data.map((u: Row) => u.email);
      assert.deepEqual(desc, [...desc].sort().reverse());

      assert.equal((await t.call("adminUsers", { orgId: await orgId(token, "northwind") }, as(token))).data.meta.total, 2);
    });

    it("paginates with a correct total, including past the last page", async () => {
      const token = await platform();
      const page = await t.call("adminUsers", { pageSize: 4, page: 3 }, as(token));
      assert.equal(page.data.data.length, 1);
      assert.deepEqual(page.data.meta, { page: 3, pageSize: 4, total: 9 });
      const past = await t.call("adminUsers", { pageSize: 4, page: 9 }, as(token));
      assert.deepEqual(past.data, { data: [], meta: { page: 9, pageSize: 4, total: 9 } });
    });

    it("limits an organization's admins to their own organization", async () => {
      const token = await orgAdmin();
      const list = await t.call("adminUsers", {}, as(token));
      assert.equal(list.data.meta.total, 2);
      assert.ok(list.data.data.every((u: Row) => u.orgName === "Northwind"));

      const jordan = await userId(await platform(), "jordan");
      assert.equal((await t.call("adminUser", { id: jordan }, as(token))).status, 404);
      assert.equal((await update(token, jordan, { name: "Pwned" })).status, 404);
      assert.equal((await t.call("suspendUser", { id: jordan }, as(token))).status, 404);
      assert.equal((await t.call("deleteUser", { id: jordan }, as(token))).status, 404);

      // An orgId filter cannot widen the scope.
      const other = await orgId(await platform(), "verity");
      assert.equal((await t.call("adminUsers", { orgId: other }, as(token))).data.meta.total, 2);
    });

    it("invites a user into an organization, emails a link, and refuses duplicates", async () => {
      const token = await platform();
      const verity = await orgId(token, "verity");
      const res = await t.call("inviteUser", { input: { email: "Zed@Verity.app", orgId: verity, role: "viewer" } }, as(token));
      assert.equal(res.status, 200);
      assert.equal(res.data.status, "invited");
      assert.equal(res.data.email, "zed@verity.app");
      assert.equal(res.data.name, "zed");
      assert.equal(res.data.role, "viewer");
      assert.equal(res.data.orgName, "Verity");
      assert.equal(t.mails.at(-1)?.to, "zed@verity.app");
      assert.ok(tokenFromMail(t.mails.at(-1)));
      assert.match(t.mails.at(-1)!.text, /^Hi zed@verity.app|http:\/\/web.test\//m);

      const dup = await t.call("inviteUser", { input: { email: "zed@verity.app", orgId: verity } }, as(token));
      assert.equal(dup.status, 409);
      assert.equal(dup.error?.code, "email_taken");

      const bad = await t.call("inviteUser", { input: { email: "nope", orgId: "" } }, as(token));
      assert.deepEqual(bad.error?.fields, { email: "emailInvalid", orgId: "required" });
      assert.equal((await t.call("inviteUser", { input: { email: "a@b.co", orgId: "00000000-0000-4000-0001-000000009999" } }, as(token))).status, 400);
    });

    it("stops an organization's admin inviting into another organization", async () => {
      const verity = await orgId(await platform(), "verity");
      const res = await t.call("inviteUser", { input: { email: "x@y.co", orgId: verity } }, as(await orgAdmin()));
      assert.equal(res.status, 400);
    });

    it("edits a user and audits the change, rejecting taken emails", async () => {
      const token = await platform();
      const id = await userId(token, "elena");
      const res = await update(token, id, { name: "Elena Cho-Martin", role: "admin" });
      assert.equal(res.status, 200);
      assert.equal(res.data.name, "Elena Cho-Martin");
      assert.equal(res.data.initials, "EC");
      assert.equal(res.data.role, "admin");

      const actions = (await t.call("auditLog", { q: "elena" }, as(token))).data.data.map((e: Row) => e.action);
      assert.ok(actions.includes("update_user") && actions.includes("update_role"));

      const taken = await update(token, id, { email: EMAIL.jordan });
      assert.equal(taken.status, 422);
      assert.deepEqual(taken.error?.fields, { email: "emailTaken" });
      // A role that does not exist is not a role: the schema refuses it before the resolver runs.
      const boss = await update(token, id, { role: "boss" });
      assert.equal(boss.http, 400);
      assert.equal((await update(token, "not-a-uuid", { name: "x" })).status, 404);
    });

    it("suspends and reinstates, and will not act on yourself", async () => {
      const token = await platform();
      const id = await userId(token, "jamie");
      assert.equal((await t.call("suspendUser", { id }, as(token))).data.status, "suspended");
      assert.equal((await t.call("reinstateUser", { id }, as(token))).data.status, "active");

      const self = await userId(token, "jordan");
      assert.equal((await t.call("suspendUser", { id: self }, as(token))).error?.code, "cannot_target_self");
      assert.equal((await t.call("reinstateUser", { id: self }, as(token))).error?.code, "cannot_target_self");
      assert.equal((await t.call("deleteUser", { id: self }, as(token))).error?.code, "cannot_target_self");
      assert.equal((await update(token, self, { role: "member" })).error?.code, "cannot_target_self");
    });

    it("reinstating an invited user who never set a password leaves them invited", async () => {
      const token = await platform();
      const id = await userId(token, "sam.r");
      await t.call("suspendUser", { id }, as(token));
      assert.equal((await t.call("reinstateUser", { id }, as(token))).data.status, "invited");
    });

    it("sends a reset link, and an invitation link for someone who has not joined yet", async () => {
      const token = await platform();
      assert.equal((await t.call("resetUserPassword", { id: await userId(token, "jamie") }, as(token))).data, true);
      assert.match(t.mails.at(-1)!.subject, /Reset/);

      await t.call("resetUserPassword", { id: await userId(token, "sam.r") }, as(token));
      assert.match(t.mails.at(-1)!.subject, /invited/);
      assert.equal((await t.call("resetUserPassword", { id: "00000000-0000-4000-0002-000000009999" }, as(token))).status, 404);
    });

    it("deletes a user", async () => {
      const token = await platform();
      const id = await userId(token, "elena");
      assert.equal((await t.call("deleteUser", { id }, as(token))).data, true);
      assert.equal((await t.call("adminUser", { id }, as(token))).status, 404);
    });

    it("runs bulk suspend and delete in one transaction, and refuses to include yourself", async () => {
      const token = await platform();
      const ids = [await userId(token, "elena"), await userId(token, "jamie")];
      const suspended = await t.call("bulkUserAction", { action: "suspend", ids }, as(token));
      assert.deepEqual(suspended.data, { affected: 2 });
      assert.equal((await t.call("adminUsers", { status: "suspended" }, as(token))).data.meta.total, 3);

      const self = await userId(token, "jordan");
      const withSelf = await t.call("bulkUserAction", { action: "delete", ids: [...ids, self] }, as(token));
      assert.equal(withSelf.status, 409);
      assert.equal((await t.call("adminUsers", {}, as(token))).data.meta.total, 9);

      assert.deepEqual((await t.call("bulkUserAction", { action: "delete", ids }, as(token))).data, { affected: 2 });
      assert.equal((await t.call("adminUsers", {}, as(token))).data.meta.total, 7);
      assert.equal((await t.call("bulkUserAction", { action: "explode", ids }, as(token))).http, 400);
      assert.equal((await t.call("bulkUserAction", { action: "delete", ids: [] }, as(token))).status, 400);
    });

    describe("owners", () => {
      it("lets one of two owners step down, and the other then cannot demote themselves", async () => {
        const token = await platform();
        const jamie = await userId(token, "jamie");
        const jordan = await userId(token, "jordan");
        assert.equal((await update(token, jamie, { role: "owner" })).status, 200);

        const jamieToken = await t.login(EMAIL.jamie);
        assert.equal((await update(jamieToken, jordan, { role: "member" })).status, 200);
        // Jordan lost admin access with the role change.
        assert.equal((await t.call("adminUsers", {}, as(token))).status, 403);

        assert.equal((await update(jamieToken, jamie, { role: "member" })).error?.code, "cannot_target_self");
      });

      it("only lets owners change owners", async () => {
        const token = await platform();
        const jamie = await userId(token, "jamie");
        await update(token, jamie, { role: "admin" });
        const adminToken = await t.login(EMAIL.jamie);
        const jordan = await userId(token, "jordan");

        assert.equal((await update(adminToken, jordan, { name: "J" })).status, 403);
        assert.equal((await t.call("suspendUser", { id: jordan }, as(adminToken))).status, 403);
        assert.equal((await t.call("deleteUser", { id: jordan }, as(adminToken))).status, 403);
        assert.equal((await update(adminToken, jamie, { role: "owner" })).status, 403);
      });

      it("will not suspend or delete the only owner of an organization", async () => {
        const token = await platform();
        const verity = await orgId(token, "verity");
        const created = await t.call("inviteUser", { input: { email: "boss@verity.app", orgId: verity, role: "owner" } }, as(token));
        assert.equal(created.status, 200);
        const id = created.data.id;
        assert.equal((await t.call("suspendUser", { id }, as(token))).error?.code, "last_owner");
        assert.equal((await t.call("deleteUser", { id }, as(token))).error?.code, "last_owner");
        assert.equal((await t.call("bulkUserAction", { action: "delete", ids: [id] }, as(token))).status, 409);
      });
    });
  });

  describe("organizations", () => {
    it("lists organizations with member counts, filtered and sorted", async () => {
      const token = await platform();
      const res = await t.call("adminOrganizations", {}, as(token));
      assert.equal(res.data.meta.total, 6);
      assert.deepEqual(res.data.data.map((o: Row) => o.name), ["Fontaine Co.", "Haldane", "Northwind", "Trestle Labs", "Umbra Labs", "Verity"]);
      assert.equal(res.data.data.find((o: Row) => o.name === "Northwind").memberCount, 2);
      assert.equal((await t.call("adminOrganizations", { plan: "pro" }, as(token))).data.meta.total, 3);
      assert.equal((await t.call("adminOrganizations", { status: "pastDue" }, as(token))).data.data[0].name, "Haldane");
      assert.equal((await t.call("adminOrganizations", { direction: "desc" }, as(token))).data.data[0].name, "Verity");
    });

    it("shows an organization's admin only their own", async () => {
      const res = await t.call("adminOrganizations", {}, as(await orgAdmin()));
      assert.deepEqual(res.data.data.map((o: Row) => o.name), ["Northwind"]);
    });

    it("lets platform admins create organizations, rejecting duplicates by name regardless of case", async () => {
      const token = await platform();
      const res = await t.call("createOrganization", { input: { name: "Acme Corp", plan: "pro" } }, as(token));
      assert.equal(res.status, 200);
      assert.equal(res.data.plan, "pro");
      assert.equal(res.data.status, "trialing");
      assert.equal(res.data.memberCount, 0);

      const dup = await t.call("createOrganization", { input: { name: "acme corp" } }, as(token));
      assert.equal(dup.status, 409);
      assert.equal(dup.error?.code, "name_taken");

      assert.equal((await t.call("createOrganization", { input: { name: "Sneaky" } }, as(await orgAdmin()))).status, 403);
      assert.deepEqual((await t.call("createOrganization", { input: { name: "" } }, as(token))).error?.fields, { name: "required" });
    });

    it("renames an organization; only platform admins may change its plan", async () => {
      const platformToken = await platform();
      const northwind = await orgId(platformToken, "northwind");
      const rename = (token: string, id: string, input: object) => t.call("updateOrganization", { id, input }, as(token));

      const own = await orgAdmin();
      const renamed = await rename(own, northwind, { name: "Northwind Group" });
      assert.equal(renamed.status, 200);
      assert.equal(renamed.data.name, "Northwind Group");

      assert.equal((await rename(own, northwind, { name: "Northwind Group", plan: "enterprise" })).status, 403);
      assert.equal((await rename(platformToken, northwind, { name: "Northwind Group", plan: "enterprise" })).data.plan, "enterprise");
      assert.equal((await rename(platformToken, northwind, { name: "verity" })).status, 409);

      const other = await orgId(platformToken, "verity");
      assert.equal((await rename(own, other, { name: "Mine now" })).status, 404);
      assert.equal((await t.call("adminOrganization", { id: other }, as(own))).status, 404);
    });
  });

  describe("audit log", () => {
    it("shows platform admins everything, newest first, filtered and searched", async () => {
      const token = await platform();
      const res = await t.call("auditLog", {}, as(token));
      assert.equal(res.data.meta.total, 8);
      const times = res.data.data.map((e: Row) => e.timestamp);
      assert.deepEqual(times, [...times].sort().reverse());
      assert.equal((await t.call("auditLog", { action: "suspend_user" }, as(token))).data.meta.total, 1);
      assert.equal((await t.call("auditLog", { q: "FONTAINE" }, as(token))).data.meta.total, 2);
    });

    it("shows an organization's admin only that organization's events", async () => {
      const res = await t.call("auditLog", {}, as(await orgAdmin()));
      assert.deepEqual(res.data.data.map((e: Row) => e.target), ["Website Redesign"]);
    });

    it("records who did what, with the actor kept as an email", async () => {
      const token = await platform();
      await t.call("createOrganization", { input: { name: "Logged Co" } }, as(token));
      const log = await t.call("auditLog", { action: "create_organization", q: "Logged" }, as(token));
      assert.equal(log.data.data[0].actor, EMAIL.jordan);
    });
  });
});
