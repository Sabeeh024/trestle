import type { ReactNode } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@trestle/ui/components/ui/breadcrumb";

export function PageHeader({
  crumb,
  title,
  action,
}: {
  crumb: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <>
      <div className="px-4 pt-4">
        <Breadcrumb>
          <BreadcrumbList className="text-xs">
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Admin</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{crumb}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <h1 className="text-xl leading-heading font-bold">{title}</h1>
        {action}
      </div>
    </>
  );
}
