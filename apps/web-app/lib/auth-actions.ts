"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isApiError } from "@trestle/api-client";
import {
  fieldErrors,
  forgotPasswordSchema,
  loginSchema,
  signupSchema,
  ssoSchema,
  type z,
} from "@trestle/api-client/schemas";
import { defaultLocale, isLocale } from "@trestle/i18n";

import { api } from "@/lib/api";
import { SESSION_COOKIE } from "@/lib/session";

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

async function startSession(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
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

export async function signOutAction(locale: string) {
  (await cookies()).delete(SESSION_COOKIE);
  redirect(`/${isLocale(locale) ? locale : defaultLocale}/login`);
}
