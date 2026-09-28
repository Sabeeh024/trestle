import { Navigate, Route, Routes } from "react-router-dom";

import { AdminLayout } from "@/components/admin-layout";
import { UsersPage } from "@/pages/users";
import { OrganizationsPage } from "@/pages/organizations";
import { AuditLogPage } from "@/pages/audit-log";

export function App() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Navigate to="/users" replace />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="organizations" element={<OrganizationsPage />} />
        <Route path="audit-log" element={<AuditLogPage />} />
      </Route>
    </Routes>
  );
}
