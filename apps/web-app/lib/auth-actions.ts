"use server";

import { redirect } from "next/navigation";
import { isApiError } from "@trestle/api-client";
import {
  fieldErrors,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  ssoSchema,
  type z,
} from "@trestle/api-client/schemas";
import { defaultLocale, isLocale } from "@trestle/i18n";

import { authApi as api } from "@/lib/api";
import { clearSessionCookie, setSessionCookie } from "@/lib/session-cookie";

// These return a plain result instead of throwing: errors thrown from a Server Action are redacted in
// production builds, and the forms need the code and per-field messages to show the right thing.
export type ActionResult =
  | { ok: true }
  | { ok: false; code: string; message: string; status: number | null; fields?: Record<string, string> };

// Every action is a public endpoint, so each one validates its input again whatever the form did.
function invalid(error: z.ZodError): ActionResult {
  return { ok: false, code: "validation_failed", message: "Some fields are invalid", status: 422, fields: fieldErrors(error) };
}

function failure(error: unknown): ActionResult {
  if (!isApiError(error)) throw error;
  return { ok: false, code: error.code, message: error.message, status: error.status, ...(error.fields ? { fields: error.fields } : {}) };
}

// This app has a server, so the API hands it the token and it keeps the token in its own HttpOnly cookie.
async function startSession(token: string | null) {
  if (!token) throw new Error("The API did not return a session token");
  await setSessionCookie(token);
}

export async function loginAction(input: unknown): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    await startSession((await api.auth.login(parsed.data)).token);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function signupAction(input: unknown): Promise<ActionResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    await startSession((await api.auth.signup(parsed.data)).token);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function ssoAction(input: unknown): Promise<ActionResult> {
  const parsed = ssoSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    await startSession((await api.auth.sso(parsed.data)).token);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function forgotPasswordAction(input: unknown): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    await api.auth.forgotPassword(parsed.data);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function resetPasswordAction(input: unknown): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  try {
    await api.auth.resetPassword(parsed.data);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export async function signOutAction(locale: string) {
  // Revoke the session on the server first: deleting the cookie alone would leave the token valid until it
  // expires. If the API is unreachable the cookie is still removed, so the person is signed out here.
  try {
    await api.auth.logout();
  } catch {}
  await clearSessionCookie();
  redirect(`/${isLocale(locale) ? locale : defaultLocale}/login`);
}
