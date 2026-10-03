"use server";

import { cookies } from "next/headers";
import { isApiError } from "@trestle/api-client";
import { fieldErrors, loginSchema } from "@trestle/api-client/schemas";

import { api } from "@/lib/api";
import { SESSION_COOKIE } from "@/lib/session";

// A plain object, not a thrown error: errors thrown from a Server Action are redacted in production
// builds, and the form needs the code and per-field messages to show the right thing.
export type LoginResult =
  | { ok: true }
  | { ok: false; code: string; message: string; status: number | null; fields?: Record<string, string> };

export async function loginAction(input: unknown): Promise<LoginResult> {
  // Validated again on the server: a Server Action is a public endpoint, whatever the form did.
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, code: "validation_failed", message: "Some fields are invalid", status: 422, fields: fieldErrors(parsed.error) };
  }

  try {
    const { token } = await api.auth.login(parsed.data);
    (await cookies()).set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
    });
    return { ok: true };
  } catch (error) {
    if (!isApiError(error)) throw error;
    return { ok: false, code: error.code, message: error.message, status: error.status, ...(error.fields ? { fields: error.fields } : {}) };
  }
}
