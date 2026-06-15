"use client"

import { useQuery } from "@tanstack/react-query"
import { DashboardSchema } from "@workspace/shared"
import { api } from "@/lib/api"

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api("/dashboard", { schema: DashboardSchema }),
    refetchInterval: 60_000,
  })
}
