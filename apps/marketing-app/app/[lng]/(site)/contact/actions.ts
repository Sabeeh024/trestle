"use server";

import { isApiError } from "@trestle/api-client";
import { contactSchema, fieldErrors } from "@trestle/api-client/schemas";

import { api } from "@/lib/api";

// A plain result rather than a thrown error: errors thrown from a Server Action are redacted in
// production builds, and the form needs the per-field messages.
export type ContactResult =
  | { ok: true }
  | { ok: false; code: string; message: string; status: number | null; fields?: Record<string, string> };

export async function sendContactAction(input: unknown): Promise<ContactResult> {
  // A Server Action is a public endpoint, so the input is validated again whatever the form did.
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "validation_failed", message: "Some fields are invalid", status: 422, fields: fieldErrors(parsed.error) };
  }

  try {
    await api.contact.send(parsed.data);
    return { ok: true };
  } catch (error) {
    if (!isApiError(error)) throw error;
    return { ok: false, code: error.code, message: error.message, status: error.status, ...(error.fields ? { fields: error.fields } : {}) };
  }
}
