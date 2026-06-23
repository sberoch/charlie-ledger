"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { DashboardSchema } from "@workspace/shared"
import { api } from "@/lib/api"

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api("/dashboard", { schema: DashboardSchema }),
    refetchInterval: 60_000,
  })
}

/** Mark a Reminder done — it leaves the timeline entirely (ADR-0007). Refreshes
 *  the dashboard so the item disappears. */
export function useMarkReminderDone() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api(`/reminders/${id}/done`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
  })
}
