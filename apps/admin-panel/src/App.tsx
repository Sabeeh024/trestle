import { Navigate, Route, Routes } from "react-router-dom";

import { AdminLayout } from "@/components/admin-layout";
import { RequireAuth } from "@/components/require-auth";
import { LoginPage } from "@/pages/login";
import { UsersPage } from "@/pages/users";
import { OrganizationsPage } from "@/pages/organizations";
import { AuditLogPage } from "@/pages/audit-log";
import { AccountPage } from "@/pages/account";

export function App() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AdminLayout />}>
          <Route index element={<Navigate to="/users" replace />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="organizations" element={<OrganizationsPage />} />
          <Route path="audit-log" element={<AuditLogPage />} />
          <Route path="account" element={<AccountPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
