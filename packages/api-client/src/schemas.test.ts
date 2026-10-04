import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  changeRoleSchema,
  commentSchema,
  createOrganizationSchema,
  contactSchema,
  createProjectSchema,
  createTaskSchema,
  fieldErrors,
  inviteUserSchema,
  isValidationKey,
  loginSchema,
  signupSchema,
  updateOrganizationSchema,
  updateProfileSchema,
  updateUserSchema,
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

  it("requires a password of at least 8 characters to sign up", () => {
    assert.equal(signupSchema.safeParse({ name: "Dana", email: "dana@example.com", password: "12345678" }).success, true);
    assert.deepEqual(errorsFor(signupSchema.safeParse({ name: "Dana", email: "dana@example.com", password: "1234567" })), { password: "passwordTooShort" });
    assert.deepEqual(errorsFor(signupSchema.safeParse({ name: "", email: "bad", password: "" })), { name: "required", email: "emailInvalid", password: "passwordTooShort" });
  });

  it("validates a profile, and accepts a partial user update", () => {
    assert.deepEqual(errorsFor(updateProfileSchema.safeParse({ name: " ", email: "x" })), { name: "required", email: "emailInvalid" });
    assert.equal(updateUserSchema.safeParse({}).success, true);
    assert.equal(updateUserSchema.safeParse({ role: "admin" }).success, true);
    assert.deepEqual(errorsFor(updateUserSchema.safeParse({ name: "", email: "no", role: "root" })), { name: "required", email: "emailInvalid", role: "invalidChoice" });
  });

  it("requires a name, an email and a message to contact sales, and treats the company as optional", () => {
    assert.equal(contactSchema.safeParse({ name: "Dana", email: "dana@example.com", message: "Hello" }).success, true);
    assert.deepEqual(errorsFor(contactSchema.safeParse({ name: "", email: "x", message: " " })), { name: "required", email: "emailInvalid", message: "required" });
    assert.deepEqual(errorsFor(contactSchema.safeParse({ name: "Dana", email: "dana@example.com", message: "a".repeat(2001) })), { message: "tooLong" });
  });

  it("requires a name to rename an organization", () => {
    assert.deepEqual(errorsFor(updateOrganizationSchema.safeParse({ name: "" })), { name: "required" });
    assert.equal(updateOrganizationSchema.safeParse({ name: "Verity Labs", plan: "pro" }).success, true);
  });

  it("treats a field that is missing altogether the same as an empty one", () => {
    assert.deepEqual(errorsFor(loginSchema.safeParse({})), { email: "required", password: "required" });
    assert.deepEqual(errorsFor(createProjectSchema.safeParse({})), { name: "required" });
    assert.deepEqual(errorsFor(inviteUserSchema.safeParse({})), { email: "required", orgId: "required" });
    assert.deepEqual(errorsFor(createTaskSchema.safeParse({})), { projectId: "required", title: "required" });
    assert.deepEqual(errorsFor(contactSchema.safeParse({})), { name: "required", email: "required", message: "required" });
  });

  it("knows which messages are validation keys", () => {
    assert.equal(isValidationKey("required"), true);
    assert.equal(isValidationKey("Incorrect email or password"), false);
    assert.equal(isValidationKey(undefined), false);
  });
});
