"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import {
  TagSchema,
  type CreateTagInput,
  type TagDto,
} from "@workspace/shared"
import { api } from "@/lib/api"

const KEY = ["settings", "tags"]

export function useTags() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api("/tags", { schema: z.array(TagSchema) }),
  })
}

export function useCreateTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateTagInput) =>
      api<TagDto>("/tags", { method: "POST", body: input, schema: TagSchema }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useRenameTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api<TagDto>(`/tags/${id}`, {
        method: "PATCH",
        body: { name },
        schema: TagSchema,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api(`/tags/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
