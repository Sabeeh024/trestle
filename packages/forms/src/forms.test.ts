import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ApiError } from "@trestle/api-client";
import { msg } from "@trestle/api-client/schemas";
import { sharedResources } from "@trestle/i18n";

import { applyApiError, fieldError, messageFor, rootError, type Translate } from "./errors";
import { submitForm } from "./submit";

const translate: Translate = (key) => `t(${key})`;

interface Recorded {
  field: string;
  error: { type?: string; message?: string };
}

function fakeForm(values: Record<string, unknown>, errors: unknown = {}) {
  const recorded: Recorded[] = [];
  const cleared: unknown[] = [];
  return {
    recorded,
    cleared,
    formState: { errors },
    getValues: () => values,
    setError: (field: string, error: Recorded["error"]) => void recorded.push({ field, error }),
    clearErrors: (name: unknown) => void cleared.push(name),
    handleSubmit: (callback: (values: unknown) => Promise<void>) => () => callback(values),
  };
}

describe("messageFor", () => {
  it("translates validation keys and leaves everything else alone", () => {
    assert.equal(messageFor("required", translate), "t(required)");
    assert.equal(messageFor("Incorrect email or password", translate), "Incorrect email or password");
  });

  it("has nothing to show for an empty message", () => {
    assert.equal(messageFor(undefined, translate), undefined);
    assert.equal(messageFor("", translate), undefined);
    assert.equal(messageFor(42, translate), undefined);
  });
});

describe("fieldError and rootError", () => {
  it("reads a top-level and a nested field's error", () => {
    const form = fakeForm({}, { email: { message: "emailInvalid" }, address: { city: { message: "required" } } });
    assert.equal(fieldError(form as never, "email", translate), "t(emailInvalid)");
    assert.equal(fieldError(form as never, "address.city" as never, translate), "t(required)");
    assert.equal(fieldError(form as never, "name" as never, translate), undefined);
  });

  it("reads the form-level server error", () => {
    const form = fakeForm({}, { root: { server: { message: "Incorrect email or password" } } });
    assert.equal(rootError(form as never, translate), "Incorrect email or password");
    assert.equal(rootError(fakeForm({}) as never, translate), undefined);
  });
});

describe("applyApiError", () => {
  it("puts a validation failure on the matching fields", () => {
    const form = fakeForm({ email: "", orgId: "" });
    applyApiError(form as never, new ApiError("Some fields are invalid", "validation_failed", 422, { email: "emailInvalid", orgId: "required" }));
    assert.deepEqual(form.recorded, [
      { field: "email", error: { type: "server", message: "emailInvalid" } },
      { field: "orgId", error: { type: "server", message: "required" } },
    ]);
  });

  it("sends fields the form does not have to the form-level error instead of dropping them", () => {
    const form = fakeForm({ name: "" });
    applyApiError(form as never, new ApiError("Some fields are invalid", "validation_failed", 422, { plan: "invalidChoice" }));
    assert.deepEqual(form.recorded, [{ field: "root.server", error: { type: "server", message: "Some fields are invalid" } }]);
  });

  it("uses the server's message for a failure with no fields", () => {
    const form = fakeForm({ email: "", password: "" });
    applyApiError(form as never, new ApiError("Incorrect email or password", "invalid_credentials", 401));
    assert.deepEqual(form.recorded, [{ field: "root.server", error: { type: "server", message: "Incorrect email or password" } }]);
  });

  it("falls back to a generic message for an unexpected error", () => {
    const form = fakeForm({});
    applyApiError(form as never, new Error("boom"), "Try again later");
    assert.deepEqual(form.recorded, [{ field: "root.server", error: { type: "server", message: "Try again later" } }]);
  });
});

describe("submitForm", () => {
  it("clears the previous server error, then runs the action with the validated values", async () => {
    const form = fakeForm({ name: "Brand" });
    let received: unknown;
    await submitForm(form as never, async (values) => void (received = values))();
    assert.deepEqual(form.cleared, ["root.server"]);
    assert.deepEqual(received, { name: "Brand" });
    assert.deepEqual(form.recorded, []);
  });

  it("puts an API failure on the form instead of rejecting", async () => {
    const form = fakeForm({ email: "" });
    const failing = async () => {
      throw new ApiError("Some fields are invalid", "validation_failed", 422, { email: "emailInvalid" });
    };
    await submitForm(form as never, failing)();
    assert.deepEqual(form.recorded, [{ field: "email", error: { type: "server", message: "emailInvalid" } }]);
  });
});

describe("validation messages", () => {
  it("has an English and an Urdu translation for every key the schemas can produce", () => {
    for (const key of Object.values(msg)) {
      assert.ok(sharedResources.en.validation[key], `en is missing "${key}"`);
      assert.ok(sharedResources.ur.validation[key], `ur is missing "${key}"`);
    }
  });

  it("does not carry translations for keys the schemas never produce", () => {
    const keys = new Set<string>(Object.values(msg));
    for (const key of Object.keys(sharedResources.en.validation)) assert.ok(keys.has(key), `"${key}" is unused`);
    assert.deepEqual(Object.keys(sharedResources.en.validation).sort(), Object.keys(sharedResources.ur.validation).sort());
  });
});
