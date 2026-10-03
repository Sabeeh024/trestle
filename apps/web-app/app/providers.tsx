"use client";

import { ApiProvider } from "@trestle/api-client/react";

import { clientApi } from "@/lib/api-client";

export function Providers({ children }: { children: React.ReactNode }) {
  return <ApiProvider api={clientApi}>{children}</ApiProvider>;
}
