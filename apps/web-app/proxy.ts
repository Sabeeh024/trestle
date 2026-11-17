import { NextRequest, NextResponse } from "next/server";
import { createProxy } from "next-i18next/proxy";
import { isLocale } from "@trestle/i18n";

import i18nConfig from "./i18n.config";
import { contentSecurityPolicy } from "./lib/security-headers";
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

  // A fresh nonce per request. It goes on the request too, so Next puts it on its own scripts and the layout
  // can put it on the theme script. The policy is report-only until the console has stayed free of reports.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = contentSecurityPolicy(nonce);
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy-Report-Only", policy);

  const response = i18nProxy(new NextRequest(request, { headers }));
  response.headers.set("Content-Security-Policy-Report-Only", policy);
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|assets|favicon.ico|sw.js|site.webmanifest).*)"],
};
