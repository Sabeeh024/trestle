import { NavLink } from "react-router-dom";
import { cn } from "cn";

import { Logo } from "@trestle/ui/components/logo";

const navItems = [
  { to: "/users", label: "Users" },
  { to: "/organizations", label: "Organizations" },
  { to: "/audit-log", label: "Audit Log" },
];

export function AdminSidebar() {
  return (
    <nav aria-label="Main" className="flex w-50 shrink-0 flex-col gap-0.5 border-r border-border bg-background-subtle p-2">
      <div className="mb-2 flex items-center gap-2 p-2">
        <Logo size="sm" wordmark={false} />
        <span className="text-[13px] font-bold">Trestle Admin</span>
      </div>

      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            cn(
              "rounded-md px-2.5 py-1.5 text-[13px] text-text-secondary",
              isActive && "-ml-0.5 border-l-2 border-action-primary bg-background-muted font-semibold text-text-primary"
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
