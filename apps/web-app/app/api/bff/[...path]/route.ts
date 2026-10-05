import { cookies } from "next/headers";

import { SESSION_COOKIE } from "@/lib/session";

// A thin proxy between the browser and the API. The session token lives in an httpOnly cookie that
// browser code cannot read, so browser-side requests (React Query in Client Components) go through
// here and the token is attached on the server. Server Components call the API directly instead.

const API_URL = process.env.API_URL ?? "http://localhost:4000";

// Writes must come from this site. The session cookie is SameSite=Lax, which already keeps other sites from
// sending it on a POST; this additionally rejects a write whose Origin is another host (a sibling subdomain, say)
// or that the browser marks as cross-site. Requests with neither header come from non-browser clients, which
// have no ambient cookie to abuse.
function isSameSiteWrite(request: Request) {
  if (request.method === "GET" || request.method === "HEAD") return true;
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

async function forward(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (!isSameSiteWrite(request)) {
    return Response.json({ error: { code: "forbidden", message: "Cross-site request refused" } }, { status: 403 });
  }
  const { path } = await params;
  // The client's endpoint paths already start with /api, so they are forwarded as given. Keep the
  // target inside that namespace.
  if (path[0] !== "api" || path.some((segment) => segment === "." || segment === ".." || segment === "")) {
    return Response.json({ error: { code: "bad_request", message: "Invalid path" } }, { status: 400 });
  }

  const target = new URL(`${API_URL}/${path.map(encodeURIComponent).join("/")}`);
  target.search = new URL(request.url).search;

  const headers = new Headers({ Accept: "application/json" });
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  let response: Response;
  try {
    response = await fetch(target, {
      method: request.method,
      headers,
      cache: "no-store",
      ...(hasBody ? { body: await request.text() } : {}),
    });
  } catch {
    return Response.json({ error: { code: "network_error", message: "Could not reach the server" } }, { status: 502 });
  }

  return new Response(response.status === 204 ? null : response.body, {
    status: response.status,
    headers: { "Content-Type": response.headers.get("content-type") ?? "application/json", "Cache-Control": "private, no-store" },
  });
}

export { forward as GET, forward as POST, forward as PATCH, forward as DELETE };
