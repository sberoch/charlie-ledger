"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import {
  AlbumSchema,
  type AlbumDto,
  type CreateAlbumInput,
} from "@workspace/shared"
import { api } from "@/lib/api"

// Albums — one list feeds the Settings panel, the Tracks list's album filter
// and its summary strip (CONTEXT.md "Album").
const KEY = ["settings", "albums"]

export function useAlbums() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api("/albums", { schema: z.array(AlbumSchema) }),
  })
}

function useInvalidateAlbums() {
  const qc = useQueryClient()
  // Rename/delete change what the Tracks list shows per row too.
  return () =>
    Promise.all(
      [KEY, ["tracks"]].map((key) => qc.invalidateQueries({ queryKey: key }))
    )
}

export function useCreateAlbum() {
  const invalidate = useInvalidateAlbums()
  return useMutation({
    mutationFn: (input: CreateAlbumInput) =>
      api<AlbumDto>("/albums", {
        method: "POST",
        body: input,
        schema: AlbumSchema,
      }),
    onSuccess: invalidate,
  })
}

export function useRenameAlbum() {
  const invalidate = useInvalidateAlbums()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api<AlbumDto>(`/albums/${id}`, {
        method: "PATCH",
        body: { name },
        schema: AlbumSchema,
      }),
    onSuccess: invalidate,
  })
}

export function useDeleteAlbum() {
  const invalidate = useInvalidateAlbums()
  return useMutation({
    mutationFn: (id: string) => api(`/albums/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  })
}
