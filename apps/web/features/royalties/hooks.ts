"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import {
  RoyaltyPaymentSchema,
  type CreateRoyaltyPaymentInput,
  type RoyaltyPaymentDto,
  type UpdateRoyaltyPaymentInput,
} from "@workspace/shared"
import { api } from "@/lib/api"

const KEY = ["royalties"]

// Unlike Leads (walled off, ADR-0005), royalty payments DO feed the Report's
// Royalties section and the dashboard's Royalty income figure (ADR-0009) —
// so mutations invalidate those too.
function useInvalidate() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: KEY })
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    void queryClient.invalidateQueries({ queryKey: ["reports"] })
  }
}

export function useRoyalties() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api("/royalties", { schema: z.array(RoyaltyPaymentSchema) }),
  })
}

export function useCreateRoyalty() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: CreateRoyaltyPaymentInput) =>
      api<RoyaltyPaymentDto>("/royalties", {
        method: "POST",
        body: input,
        schema: RoyaltyPaymentSchema,
      }),
    onSuccess: invalidate,
  })
}

export function useUpdateRoyalty(id: string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: UpdateRoyaltyPaymentInput) =>
      api<RoyaltyPaymentDto>(`/royalties/${id}`, {
        method: "PATCH",
        body: input,
        schema: RoyaltyPaymentSchema,
      }),
    onSuccess: invalidate,
  })
}

export function useDeleteRoyalty() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: string) => api(`/royalties/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  })
}
