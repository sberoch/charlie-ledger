"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import {
  InvoiceSchema,
  type InvoiceDto,
  type InvoiceListQuery,
  type UpdateInvoiceDatesInput,
  type VoidAndReissueInput,
} from "@workspace/shared"
import { api } from "@/lib/api"

export function useInvoices(query: InvoiceListQuery = {}) {
  return useQuery({
    queryKey: ["invoices", query],
    queryFn: () => api("/invoices", { query, schema: z.array(InvoiceSchema) }),
  })
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: ["invoices", id],
    queryFn: () => api(`/invoices/${id}`, { schema: InvoiceSchema }),
  })
}

function useInvalidate() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all(
      ["invoices", "licenses", "demos", "dashboard"].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] })
      )
    )
}

export function useMarkPaid(id: string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (paidDate: string) =>
      api<InvoiceDto>(`/invoices/${id}/paid`, {
        method: "POST",
        body: { paidDate },
        schema: InvoiceSchema,
      }),
    onSuccess: invalidate,
  })
}

export function useClearPaid(id: string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: () =>
      api<InvoiceDto>(`/invoices/${id}/paid`, {
        method: "DELETE",
        schema: InvoiceSchema,
      }),
    onSuccess: invalidate,
  })
}

/** Dates are lifecycle fields (ADR-0014) — the snapshot has no edit path. */
export function useUpdateInvoiceDates(id: string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: UpdateInvoiceDatesInput) =>
      api<InvoiceDto>(`/invoices/${id}/dates`, {
        method: "PATCH",
        body: input,
        schema: InvoiceSchema,
      }),
    onSuccess: invalidate,
  })
}

export function useVoidAndReissue(id: string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: VoidAndReissueInput = {}) =>
      api<InvoiceDto>(`/invoices/${id}/void-and-reissue`, {
        method: "POST",
        body: input,
        schema: InvoiceSchema,
      }),
    onSuccess: invalidate,
  })
}
