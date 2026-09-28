import { Outlet } from "react-router-dom";

import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminTopBar } from "@/components/admin-topbar";

export function AdminLayout() {
  return (
    <div className="flex min-h-screen bg-background text-text-primary">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopBar />
        <Outlet />
      </div>
    </div>
  );
}
