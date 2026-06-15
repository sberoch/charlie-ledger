"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import {
  DemoSchema,
  type ConvertDemoInput,
  type CreateDemoInput,
  type DemoDto,
  type DemoListQuery,
  type UpdateDemoInput,
} from "@workspace/shared"
import { api } from "@/lib/api"

export function useDemos(query: DemoListQuery = {}) {
  return useQuery({
    queryKey: ["demos", query],
    queryFn: () => api("/demos", { query, schema: z.array(DemoSchema) }),
  })
}

export function useDemo(id: string) {
  return useQuery({
    queryKey: ["demos", id],
    queryFn: () => api(`/demos/${id}`, { schema: DemoSchema }),
  })
}

function useInvalidate() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all(
      ["demos", "invoices", "dashboard", "tracks"].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] })
      )
    )
}

export function useCreateDemo() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: CreateDemoInput) =>
      api<DemoDto>("/demos", {
        method: "POST",
        body: input,
        schema: DemoSchema,
      }),
    onSuccess: invalidate,
  })
}

export function useUpdateDemo(id: string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: UpdateDemoInput) =>
      api<DemoDto>(`/demos/${id}`, {
        method: "PATCH",
        body: input,
        schema: DemoSchema,
      }),
    onSuccess: invalidate,
  })
}

export function useConvertDemo(id: string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: ConvertDemoInput) =>
      api<DemoDto>(`/demos/${id}/convert`, {
        method: "POST",
        body: input,
        schema: DemoSchema,
      }),
    onSuccess: invalidate,
  })
}

export function useLinkConvertedTrack(id: string) {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (convertedTrackId: string | null) =>
      api<DemoDto>(`/demos/${id}/converted-track`, {
        method: "PATCH",
        body: { convertedTrackId },
        schema: DemoSchema,
      }),
    onSuccess: invalidate,
  })
}
