import { redirect } from "next/navigation";

import { defaultLocale, isLocale } from "@trestle/i18n";

import { clearSessionCookie } from "@/lib/session-cookie";

// Where a page lands when the API says the session is no longer good (signed out from another device, password
// changed, expired). It forgets the dead cookie and sends the person to sign in, instead of an error page.
export async function GET(_request: Request, { params }: { params: Promise<{ lng: string }> }) {
  const { lng } = await params;
  await clearSessionCookie();
  redirect(`/${isLocale(lng) ? lng : defaultLocale}/login`);
}
