"use client";

import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { createContext, use, useMemo, type ReactNode } from "react";

import type { Api } from "../api";
import { createQueries, type Queries } from "../query/queries";
import { getQueryClient } from "../query/query-client";

interface ApiContextValue {
  api: Api;
  queries: Queries;
}

const ApiContext = createContext<ApiContextValue | null>(null);

export function ApiProvider({ api, queryClient, children }: { api: Api; queryClient?: QueryClient; children: ReactNode }) {
  const value = useMemo(() => ({ api, queries: createQueries(api) }), [api]);

  return (
    <QueryClientProvider client={queryClient ?? getQueryClient()}>
      <ApiContext value={value}>{children}</ApiContext>
    </QueryClientProvider>
  );
}

export function useApi(): ApiContextValue {
  const value = use(ApiContext);
  if (!value) throw new Error("useApi must be used inside <ApiProvider>");
  return value;
}
