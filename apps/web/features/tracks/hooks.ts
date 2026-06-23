"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import {
  TrackDetailSchema,
  TrackListItemSchema,
  type CreateTrackInput,
  type TrackDetailDto,
  type TrackListQuery,
  type TrackStatus,
  type UpdateTrackInput,
} from "@workspace/shared"
import { api } from "@/lib/api"

export function useTracks(query: TrackListQuery = {}) {
  return useQuery({
    queryKey: ["tracks", query],
    queryFn: () =>
      api("/tracks", { query, schema: z.array(TrackListItemSchema) }),
  })
}

export function useTrackTags() {
  return useQuery({
    queryKey: ["tracks", "tags"],
    queryFn: () => api("/tracks/tags", { schema: z.array(z.string()) }),
  })
}

export function useTrack(id: string) {
  return useQuery({
    queryKey: ["tracks", id],
    queryFn: () => api(`/tracks/${id}`, { schema: TrackDetailSchema }),
  })
}

function useInvalidateCatalog() {
  const queryClient = useQueryClient()
  // Track mutations ripple into the dashboard (Tag trend) and — when a tag is
  // pick-or-created inline — the Settings vocabulary. ["tracks"] also covers the
  // in-use tag chips (["tracks","tags"]) by prefix.
  return () =>
    Promise.all(
      [["tracks"], ["dashboard"], ["settings", "tags"]].map((key) =>
        queryClient.invalidateQueries({ queryKey: key })
      )
    )
}

export function useCreateTrack() {
  const invalidate = useInvalidateCatalog()
  return useMutation({
    mutationFn: (input: CreateTrackInput) =>
      api<TrackDetailDto>("/tracks", {
        method: "POST",
        body: input,
        schema: TrackDetailSchema,
      }),
    onSuccess: invalidate,
  })
}

export function useUpdateTrack(id: string) {
  const invalidate = useInvalidateCatalog()
  return useMutation({
    mutationFn: (input: UpdateTrackInput) =>
      api<TrackDetailDto>(`/tracks/${id}`, {
        method: "PATCH",
        body: input,
        schema: TrackDetailSchema,
      }),
    onSuccess: invalidate,
  })
}

export function useSetTrackStatus(id: string) {
  const invalidate = useInvalidateCatalog()
  return useMutation({
    mutationFn: (status: TrackStatus) =>
      api<TrackDetailDto>(`/tracks/${id}/status`, {
        method: "PATCH",
        body: { status },
        schema: TrackDetailSchema,
      }),
    onSuccess: invalidate,
  })
}

export function useDeleteTrack() {
  const invalidate = useInvalidateCatalog()
  return useMutation({
    mutationFn: (id: string) => api(`/tracks/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  })
}
