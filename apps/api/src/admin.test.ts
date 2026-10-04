import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";

import { EMAIL, setup, tokenFromMail } from "./test-utils";

describe("admin", async () => {
  const t = await setup();
  beforeEach(() => t.reset());
  after(() => t.close());

  const platform = () => t.login(EMAIL.jordan); // owner of the platform organization
  const orgAdmin = () => t.login(EMAIL.alex); // admin of Northwind only

  const userId = async (token: string, q: string) => (await t.request("GET", `/api/admin/users?q=${encodeURIComponent(q)}`, { token })).body.data[0].id as string;

  it("is only for owners and admins", async () => {
    assert.equal((await t.request("GET", "/api/admin/users")).status, 401);
    const member = await t.login(EMAIL.maya);
    const res = await t.request("GET", "/api/admin/users", { token: member });
    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, "forbidden");
  });

  describe("users", () => {
    it("lists every user for platform admins, with their organization's name", async () => {
      const res = await t.request("GET", "/api/admin/users", { token: await platform() });
      assert.equal(res.body.meta.total, 9);
      const jordan = res.body.data.find((u: { email: string }) => u.email === EMAIL.jordan);
      assert.equal(jordan.orgName, "Trestle Labs");
      assert.equal(jordan.status, "active");
      assert.equal("passwordHash" in jordan, false);
    });

    it("filters, searches and sorts case-insensitively in both directions", async () => {
      const token = await platform();
      assert.equal((await t.request("GET", "/api/admin/users?role=admin", { token })).body.meta.total, 2);
      assert.equal((await t.request("GET", "/api/admin/users?status=invited", { token })).body.meta.total, 2);
      assert.equal((await t.request("GET", "/api/admin/users?q=NORTHWIND", { token })).body.meta.total, 2);

      const asc = (await t.request("GET", "/api/admin/users?sort=name", { token })).body.data.map((u: { name: string }) => u.name);
      assert.deepEqual(asc, [...asc].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
      const desc = (await t.request("GET", "/api/admin/users?sort=email&direction=desc", { token })).body.data.map((u: { email: string }) => u.email);
      assert.deepEqual(desc, [...desc].sort().reverse());

      const orgId = (await t.request("GET", "/api/admin/organizations?q=northwind", { token })).body.data[0].id;
      assert.equal((await t.request("GET", `/api/admin/users?orgId=${orgId}`, { token })).body.meta.total, 2);
    });

    it("paginates with a correct total, including past the last page", async () => {
      const token = await platform();
      const page = await t.request("GET", "/api/admin/users?pageSize=4&page=3", { token });
      assert.equal(page.body.data.length, 1);
      assert.deepEqual(page.body.meta, { page: 3, pageSize: 4, total: 9 });
      const past = await t.request("GET", "/api/admin/users?pageSize=4&page=9", { token });
      assert.deepEqual(past.body, { data: [], meta: { page: 9, pageSize: 4, total: 9 } });
    });

    it("limits an organization's admins to their own organization", async () => {
      const token = await orgAdmin();
      const list = await t.request("GET", "/api/admin/users", { token });
      assert.equal(list.body.meta.total, 2);
      assert.ok(list.body.data.every((u: { orgName: string }) => u.orgName === "Northwind"));

      const jordan = await userId(await platform(), "jordan");
      assert.equal((await t.request("GET", `/api/admin/users/${jordan}`, { token })).status, 404);
      assert.equal((await t.request("PATCH", `/api/admin/users/${jordan}`, { token, body: { name: "Pwned" } })).status, 404);
      assert.equal((await t.request("POST", `/api/admin/users/${jordan}/suspend`, { token })).status, 404);
      assert.equal((await t.request("DELETE", `/api/admin/users/${jordan}`, { token })).status, 404);

      // An orgId filter cannot widen the scope.
      const orgs = await t.request("GET", "/api/admin/organizations", { token: await platform() });
      const other = orgs.body.data.find((o: { name: string }) => o.name === "Verity").id;
      assert.equal((await t.request("GET", `/api/admin/users?orgId=${other}`, { token })).body.meta.total, 2);
    });

    it("invites a user into an organization, emails a link, and refuses duplicates", async () => {
      const token = await platform();
      const orgId = (await t.request("GET", "/api/admin/organizations?q=verity", { token })).body.data[0].id;
      const res = await t.request("POST", "/api/admin/users/invite", { token, body: { email: "Zed@Verity.app", orgId, role: "viewer" } });
      assert.equal(res.status, 201);
      assert.equal(res.body.data.status, "invited");
      assert.equal(res.body.data.email, "zed@verity.app");
      assert.equal(res.body.data.name, "zed");
      assert.equal(res.body.data.role, "viewer");
      assert.equal(res.body.data.orgName, "Verity");
      assert.equal(t.mails.at(-1)?.to, "zed@verity.app");
      assert.ok(tokenFromMail(t.mails.at(-1)));
      assert.match(t.mails.at(-1)!.text, /^Hi zed@verity.app|http:\/\/web.test\//m);

      const dup = await t.request("POST", "/api/admin/users/invite", { token, body: { email: "zed@verity.app", orgId } });
      assert.equal(dup.status, 409);
      assert.equal(dup.body.error.code, "email_taken");

      const bad = await t.request("POST", "/api/admin/users/invite", { token, body: { email: "nope", orgId: "" } });
      assert.deepEqual(bad.body.error.fields, { email: "emailInvalid", orgId: "required" });
      assert.equal((await t.request("POST", "/api/admin/users/invite", { token, body: { email: "a@b.co", orgId: "00000000-0000-4000-0001-000000009999" } })).status, 400);
    });

    it("stops an organization's admin inviting into another organization", async () => {
      const orgs = (await t.request("GET", "/api/admin/organizations", { token: await platform() })).body.data;
      const verity = orgs.find((o: { name: string }) => o.name === "Verity").id;
      const res = await t.request("POST", "/api/admin/users/invite", { token: await orgAdmin(), body: { email: "x@y.co", orgId: verity } });
      assert.equal(res.status, 400);
    });

    it("edits a user and audits the change, rejecting taken emails", async () => {
      const token = await platform();
      const id = await userId(token, "elena");
      const res = await t.request("PATCH", `/api/admin/users/${id}`, { token, body: { name: "Elena Cho-Martin", role: "admin" } });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.name, "Elena Cho-Martin");
      assert.equal(res.body.data.initials, "EC");
      assert.equal(res.body.data.role, "admin");

      const log = await t.request("GET", "/api/admin/audit-log?q=elena", { token });
      const actions = log.body.data.map((e: { action: string }) => e.action);
      assert.ok(actions.includes("update_user") && actions.includes("update_role"));

      const taken = await t.request("PATCH", `/api/admin/users/${id}`, { token, body: { email: EMAIL.jordan } });
      assert.equal(taken.status, 422);
      assert.deepEqual(taken.body.error.fields, { email: "emailTaken" });
      assert.equal((await t.request("PATCH", `/api/admin/users/${id}`, { token, body: { role: "boss" } })).status, 422);
      assert.equal((await t.request("PATCH", "/api/admin/users/not-a-uuid", { token, body: { name: "x" } })).status, 404);
    });

    it("suspends and reinstates, and will not act on yourself", async () => {
      const token = await platform();
      const id = await userId(token, "jamie");
      assert.equal((await t.request("POST", `/api/admin/users/${id}/suspend`, { token })).body.data.status, "suspended");
      assert.equal((await t.request("POST", `/api/admin/users/${id}/reinstate`, { token })).body.data.status, "active");

      const self = await userId(token, "jordan");
      for (const path of ["suspend", "reinstate"]) {
        assert.equal((await t.request("POST", `/api/admin/users/${self}/${path}`, { token })).body.error.code, "cannot_target_self");
      }
      assert.equal((await t.request("DELETE", `/api/admin/users/${self}`, { token })).body.error.code, "cannot_target_self");
      assert.equal((await t.request("PATCH", `/api/admin/users/${self}`, { token, body: { role: "member" } })).body.error.code, "cannot_target_self");
    });

    it("reinstating an invited user who never set a password leaves them invited", async () => {
      const token = await platform();
      const id = await userId(token, "sam.r");
      await t.request("POST", `/api/admin/users/${id}/suspend`, { token });
      assert.equal((await t.request("POST", `/api/admin/users/${id}/reinstate`, { token })).body.data.status, "invited");
    });

    it("sends a reset link, and an invitation link for someone who has not joined yet", async () => {
      const token = await platform();
      const reset = await t.request("POST", `/api/admin/users/${await userId(token, "jamie")}/reset-password`, { token });
      assert.equal(reset.status, 204);
      assert.match(t.mails.at(-1)!.subject, /Reset/);

      await t.request("POST", `/api/admin/users/${await userId(token, "sam.r")}/reset-password`, { token });
      assert.match(t.mails.at(-1)!.subject, /invited/);
      assert.equal((await t.request("POST", `/api/admin/users/${"00000000-0000-4000-0002-000000009999"}/reset-password`, { token })).status, 404);
    });

    it("deletes a user", async () => {
      const token = await platform();
      const id = await userId(token, "elena");
      assert.equal((await t.request("DELETE", `/api/admin/users/${id}`, { token })).status, 204);
      assert.equal((await t.request("GET", `/api/admin/users/${id}`, { token })).status, 404);
    });

    it("runs bulk suspend and delete in one transaction, and refuses to include yourself", async () => {
      const token = await platform();
      const ids = [await userId(token, "elena"), await userId(token, "jamie")];
      const suspended = await t.request("POST", "/api/admin/users/bulk", { token, body: { action: "suspend", ids } });
      assert.deepEqual(suspended.body.data, { affected: 2 });
      assert.equal((await t.request("GET", "/api/admin/users?status=suspended", { token })).body.meta.total, 3);

      const self = await userId(token, "jordan");
      const withSelf = await t.request("POST", "/api/admin/users/bulk", { token, body: { action: "delete", ids: [...ids, self] } });
      assert.equal(withSelf.status, 409);
      assert.equal((await t.request("GET", "/api/admin/users", { token })).body.meta.total, 9);

      assert.deepEqual((await t.request("POST", "/api/admin/users/bulk", { token, body: { action: "delete", ids } })).body.data, { affected: 2 });
      assert.equal((await t.request("GET", "/api/admin/users", { token })).body.meta.total, 7);
      assert.equal((await t.request("POST", "/api/admin/users/bulk", { token, body: { action: "explode", ids } })).status, 400);
      assert.equal((await t.request("POST", "/api/admin/users/bulk", { token, body: { action: "delete", ids: [] } })).status, 400);
    });

    describe("owners", () => {
      it("lets one of two owners step down, and the other then cannot demote themselves", async () => {
        const token = await platform();
        const jamie = await userId(token, "jamie");
        const jordan = await userId(token, "jordan");
        assert.equal((await t.request("PATCH", `/api/admin/users/${jamie}`, { token, body: { role: "owner" } })).status, 200);

        const jamieToken = await t.login(EMAIL.jamie);
        const demoted = await t.request("PATCH", `/api/admin/users/${jordan}`, { token: jamieToken, body: { role: "member" } });
        assert.equal(demoted.status, 200);
        // Jordan lost admin access with the role change.
        assert.equal((await t.request("GET", "/api/admin/users", { token })).status, 403);

        const self = await t.request("PATCH", `/api/admin/users/${jamie}`, { token: jamieToken, body: { role: "member" } });
        assert.equal(self.body.error.code, "cannot_target_self");
      });

      it("only lets owners change owners", async () => {
        const token = await platform();
        const jamie = await userId(token, "jamie");
        await t.request("PATCH", `/api/admin/users/${jamie}`, { token, body: { role: "admin" } });
        const adminToken = await t.login(EMAIL.jamie);
        const jordan = await userId(token, "jordan");

        assert.equal((await t.request("PATCH", `/api/admin/users/${jordan}`, { token: adminToken, body: { name: "J" } })).status, 403);
        assert.equal((await t.request("POST", `/api/admin/users/${jordan}/suspend`, { token: adminToken })).status, 403);
        assert.equal((await t.request("DELETE", `/api/admin/users/${jordan}`, { token: adminToken })).status, 403);
        assert.equal((await t.request("PATCH", `/api/admin/users/${jamie}`, { token: adminToken, body: { role: "owner" } })).status, 403);
      });

      it("will not suspend or delete the only owner of an organization", async () => {
        const token = await platform();
        const orgs = (await t.request("GET", "/api/admin/organizations", { token })).body.data;
        const verity = orgs.find((o: { name: string }) => o.name === "Verity").id;
        const created = await t.request("POST", "/api/admin/users/invite", { token, body: { email: "boss@verity.app", orgId: verity, role: "owner" } });
        assert.equal(created.status, 201);
        const id = created.body.data.id;
        assert.equal((await t.request("POST", `/api/admin/users/${id}/suspend`, { token })).body.error.code, "last_owner");
        assert.equal((await t.request("DELETE", `/api/admin/users/${id}`, { token })).body.error.code, "last_owner");
        assert.equal((await t.request("POST", "/api/admin/users/bulk", { token, body: { action: "delete", ids: [id] } })).status, 409);
      });
    });
  });

  describe("organizations", () => {
    it("lists organizations with member counts, filtered and sorted", async () => {
      const token = await platform();
      const res = await t.request("GET", "/api/admin/organizations", { token });
      assert.equal(res.body.meta.total, 6);
      assert.deepEqual(res.body.data.map((o: { name: string }) => o.name), ["Fontaine Co.", "Haldane", "Northwind", "Trestle Labs", "Umbra Labs", "Verity"]);
      assert.equal(res.body.data.find((o: { name: string }) => o.name === "Northwind").memberCount, 2);
      assert.equal((await t.request("GET", "/api/admin/organizations?plan=pro", { token })).body.meta.total, 3);
      assert.equal((await t.request("GET", "/api/admin/organizations?status=pastDue", { token })).body.data[0].name, "Haldane");
      assert.equal((await t.request("GET", "/api/admin/organizations?direction=desc", { token })).body.data[0].name, "Verity");
    });

    it("shows an organization's admin only their own", async () => {
      const res = await t.request("GET", "/api/admin/organizations", { token: await orgAdmin() });
      assert.deepEqual(res.body.data.map((o: { name: string }) => o.name), ["Northwind"]);
    });

    it("lets platform admins create organizations, rejecting duplicates by name regardless of case", async () => {
      const token = await platform();
      const res = await t.request("POST", "/api/admin/organizations", { token, body: { name: "Acme Corp", plan: "pro" } });
      assert.equal(res.status, 201);
      assert.equal(res.body.data.plan, "pro");
      assert.equal(res.body.data.status, "trialing");
      assert.equal(res.body.data.memberCount, 0);

      const dup = await t.request("POST", "/api/admin/organizations", { token, body: { name: "acme corp" } });
      assert.equal(dup.status, 409);
      assert.equal(dup.body.error.code, "name_taken");

      assert.equal((await t.request("POST", "/api/admin/organizations", { token: await orgAdmin(), body: { name: "Sneaky" } })).status, 403);
      assert.deepEqual((await t.request("POST", "/api/admin/organizations", { token, body: { name: "" } })).body.error.fields, { name: "required" });
    });

    it("renames an organization; only platform admins may change its plan", async () => {
      const platformToken = await platform();
      const northwind = (await t.request("GET", "/api/admin/organizations?q=northwind", { token: platformToken })).body.data[0].id;

      const own = await orgAdmin();
      const rename = await t.request("PATCH", `/api/admin/organizations/${northwind}`, { token: own, body: { name: "Northwind Group" } });
      assert.equal(rename.status, 200);
      assert.equal(rename.body.data.name, "Northwind Group");

      const upgrade = await t.request("PATCH", `/api/admin/organizations/${northwind}`, { token: own, body: { name: "Northwind Group", plan: "enterprise" } });
      assert.equal(upgrade.status, 403);

      const byPlatform = await t.request("PATCH", `/api/admin/organizations/${northwind}`, { token: platformToken, body: { name: "Northwind Group", plan: "enterprise" } });
      assert.equal(byPlatform.body.data.plan, "enterprise");

      const clash = await t.request("PATCH", `/api/admin/organizations/${northwind}`, { token: platformToken, body: { name: "verity" } });
      assert.equal(clash.status, 409);

      const other = (await t.request("GET", "/api/admin/organizations?q=verity", { token: platformToken })).body.data[0].id;
      assert.equal((await t.request("PATCH", `/api/admin/organizations/${other}`, { token: own, body: { name: "Mine now" } })).status, 404);
      assert.equal((await t.request("GET", `/api/admin/organizations/${other}`, { token: own })).status, 404);
    });
  });

  describe("audit log", () => {
    it("shows platform admins everything, newest first, filtered and searched", async () => {
      const token = await platform();
      const res = await t.request("GET", "/api/admin/audit-log", { token });
      assert.equal(res.body.meta.total, 8);
      const times = res.body.data.map((e: { timestamp: string }) => e.timestamp);
      assert.deepEqual(times, [...times].sort().reverse());
      assert.equal((await t.request("GET", "/api/admin/audit-log?action=suspend_user", { token })).body.meta.total, 1);
      assert.equal((await t.request("GET", "/api/admin/audit-log?q=FONTAINE", { token })).body.meta.total, 2);
    });

    it("shows an organization's admin only that organization's events", async () => {
      const res = await t.request("GET", "/api/admin/audit-log", { token: await orgAdmin() });
      assert.deepEqual(res.body.data.map((e: { target: string }) => e.target), ["Website Redesign"]);
    });

    it("records who did what, with the actor kept as an email", async () => {
      const token = await platform();
      await t.request("POST", "/api/admin/organizations", { token, body: { name: "Logged Co" } });
      const log = await t.request("GET", "/api/admin/audit-log?action=create_organization&q=Logged", { token });
      assert.equal(log.body.data[0].actor, EMAIL.jordan);
    });
  });
});
