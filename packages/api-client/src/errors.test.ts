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

  it("reads a GraphQL error, preferring the status the API put in its extensions over the transport's", () => {
    const error = apiErrorFromResponse(200, {
      data: null,
      errors: [{ message: "Task not found", extensions: { code: "not_found", status: 404 } }],
    });
    assert.equal(error.status, 404);
    assert.equal(error.code, "not_found");
    assert.equal(error.message, "Task not found");
  });

  it("falls back to the transport status for a GraphQL error without one", () => {
    assert.equal(apiErrorFromResponse(400, { errors: [{ message: "Syntax error" }] }).status, 400);
    assert.equal(apiErrorFromResponse(401, { data: null, errors: [] }).status, 401);
  });

  it("ignores field entries that are not strings", () => {
    const error = apiErrorFromResponse(422, { error: { code: "x", message: "y", fields: { email: "emailInvalid", bad: 3, worse: null } } });
    assert.deepEqual(error.fields, { email: "emailInvalid" });
  });
});
