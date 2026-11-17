import { Outlet } from "react-router-dom";

import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminTopBar } from "@/components/admin-topbar";
import { Announcer } from "@/components/announcer";

export function AdminLayout() {
  return (
    <div className="flex min-h-screen bg-background text-text-primary">
      {/* The first Tab stop: lets keyboard users skip the navigation. Hidden until focused. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lg focus:ring-3 focus:ring-ring/30 focus:outline-none"
      >
        Skip to main content
      </a>
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopBar />
        <main id="main-content" tabIndex={-1} className="flex min-h-0 min-w-0 flex-1 flex-col outline-none">
          <Outlet />
        </main>
      </div>
      <Announcer />
    </div>
  );
}
