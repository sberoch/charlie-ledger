"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import {
  LeadSchema,
  type CreateLeadInput,
  type LeadDto,
  type UpdateLeadInput,
} from "@workspace/shared"
import { api } from "@/lib/api"

// Leads are walled off (ADR-0005) — mutations invalidate only ["leads"]; they
// never touch invoices / dashboard / tracks the way License/Demo mutations do.
const KEY = ["leads"]

export function useLeads() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api("/leads", { schema: z.array(LeadSchema) }),
  })
}

export function useCreateLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateLeadInput) =>
      api<LeadDto>("/leads", {
        method: "POST",
        body: input,
        schema: LeadSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateLead(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateLeadInput) =>
      api<LeadDto>(`/leads/${id}`, {
        method: "PATCH",
        body: input,
        schema: LeadSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api(`/leads/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}
