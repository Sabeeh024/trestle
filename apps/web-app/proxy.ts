import { NextResponse, type NextRequest } from "next/server";
import { createProxy } from "next-i18next/proxy";
import { isLocale } from "@trestle/i18n";

import i18nConfig from "./i18n.config";
import { PUBLIC_SECTIONS, SESSION_COOKIE } from "./lib/session";

const i18nProxy = createProxy(i18nConfig);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const [, lng = "", section] = pathname.split("/");

  // Only the cookie's presence is checked here; the API decides whether the token is still good.
  if (isLocale(lng) && section && !PUBLIC_SECTIONS.has(section) && !request.cookies.has(SESSION_COOKIE)) {
    const login = request.nextUrl.clone();
    login.pathname = `/${lng}/login`;
    login.search = "";
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return i18nProxy(request);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|assets|favicon.ico|sw.js|site.webmanifest).*)"],
};
