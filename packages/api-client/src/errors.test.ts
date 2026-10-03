import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { apiErrorFromResponse } from "./errors";

describe("apiErrorFromResponse", () => {
  it("reads per-field messages from a validation failure", () => {
    const error = apiErrorFromResponse(422, {
      error: { code: "validation_failed", message: "Some fields are invalid", fields: { email: "emailInvalid", name: "required" } },
    });
    assert.equal(error.status, 422);
    assert.equal(error.code, "validation_failed");
    assert.deepEqual(error.fields, { email: "emailInvalid", name: "required" });
  });

  it("has no fields when the body does not carry any", () => {
    assert.equal(apiErrorFromResponse(404, { error: { code: "not_found", message: "Nope" } }).fields, undefined);
    assert.equal(apiErrorFromResponse(500, "<html>").fields, undefined);
  });

  it("ignores field entries that are not strings", () => {
    const error = apiErrorFromResponse(422, { error: { code: "x", message: "y", fields: { email: "emailInvalid", bad: 3, worse: null } } });
    assert.deepEqual(error.fields, { email: "emailInvalid" });
  });
});
