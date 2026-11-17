import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useSession } from "@/lib/session";

export function RequireAuth() {
  const session = useSession();
  const location = useLocation();

  if (session.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-text-secondary" role="status">
        Loading…
      </div>
    );
  }
  if (session.status === "signed-out") return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
