import { cookies } from "next/headers";

import { SESSION_COOKIE } from "@/lib/session";

// A thin proxy between the browser and the API. The session token lives in an httpOnly cookie that
// browser code cannot read, so browser-side requests (React Query in Client Components) go through
// here and the token is attached on the server. Server Components call the API directly instead.

const API_URL = process.env.API_URL ?? "http://localhost:4000";

async function forward(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
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
    headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" },
  });
}

export { forward as GET, forward as POST, forward as PATCH, forward as DELETE };
