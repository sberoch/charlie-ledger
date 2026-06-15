"use client"

import { useQuery } from "@tanstack/react-query"
import { z } from "zod"
import {
  TrackDetailSchema,
  TrackListItemSchema,
  type TrackListQuery,
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
