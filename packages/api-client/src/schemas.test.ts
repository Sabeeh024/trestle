import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  changeRoleSchema,
  commentSchema,
  createOrganizationSchema,
  createProjectSchema,
  createTaskSchema,
  fieldErrors,
  inviteUserSchema,
  isValidationKey,
  loginSchema,
} from "./schemas";

const errorsFor = (result: { success: boolean; error?: Parameters<typeof fieldErrors>[0] }) =>
  result.success ? {} : fieldErrors(result.error!);

describe("schemas", () => {
  it("login requires an email in a valid shape and a password", () => {
    assert.equal(loginSchema.safeParse({ email: "jordan@trestle.io", password: "x" }).success, true);
    assert.deepEqual(errorsFor(loginSchema.safeParse({ email: "", password: "" })), { email: "required", password: "required" });
    assert.deepEqual(errorsFor(loginSchema.safeParse({ email: "nope", password: "x" })), { email: "emailInvalid" });
  });

  it("trims text before checking it, so whitespace is not a name", () => {
    assert.deepEqual(errorsFor(createProjectSchema.safeParse({ name: "   " })), { name: "required" });
    assert.equal(createProjectSchema.parse({ name: "  Brand  " }).name, "Brand");
  });

  it("enforces length limits", () => {
    assert.deepEqual(errorsFor(createProjectSchema.safeParse({ name: "a".repeat(81) })), { name: "tooLong" });
    assert.deepEqual(errorsFor(createProjectSchema.safeParse({ name: "ok", description: "a".repeat(501) })), { description: "tooLong" });
  });

  it("accepts an empty optional date but rejects a malformed or impossible one", () => {
    assert.equal(createProjectSchema.safeParse({ name: "ok", dueDate: "" }).success, true);
    assert.equal(createProjectSchema.safeParse({ name: "ok", dueDate: "2026-10-10" }).success, true);
    assert.deepEqual(errorsFor(createProjectSchema.safeParse({ name: "ok", dueDate: "10/10/2026" })), { dueDate: "dateInvalid" });
    assert.deepEqual(errorsFor(createProjectSchema.safeParse({ name: "ok", dueDate: "2026-13-45" })), { dueDate: "dateInvalid" });
  });

  it("validates enums with a single choice message", () => {
    assert.equal(createTaskSchema.safeParse({ projectId: "p", title: "t", priority: "high" }).success, true);
    assert.deepEqual(errorsFor(createTaskSchema.safeParse({ projectId: "p", title: "t", priority: "huge" })), { priority: "invalidChoice" });
    assert.deepEqual(errorsFor(changeRoleSchema.safeParse({ role: "root" })), { role: "invalidChoice" });
    assert.deepEqual(errorsFor(changeRoleSchema.safeParse({})), { role: "invalidChoice" });
  });

  it("reports each invalid field once, keyed by field name", () => {
    assert.deepEqual(errorsFor(inviteUserSchema.safeParse({ email: "bad", orgId: "" })), { email: "emailInvalid", orgId: "required" });
    assert.deepEqual(errorsFor(createOrganizationSchema.safeParse({ name: "" })), { name: "required" });
    assert.deepEqual(errorsFor(commentSchema.safeParse({ body: " " })), { body: "required" });
  });

  it("knows which messages are validation keys", () => {
    assert.equal(isValidationKey("required"), true);
    assert.equal(isValidationKey("Incorrect email or password"), false);
    assert.equal(isValidationKey(undefined), false);
  });
});
