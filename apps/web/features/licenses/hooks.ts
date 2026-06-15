"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import {
  CollisionCheckResultSchema,
  LicenseDetailSchema,
  LicenseSchema,
  SimilarLicensesResultSchema,
  type CollisionCheckQuery,
  type CreateLicenseInput,
  type LicenseDetailDto,
  type LicenseListQuery,
  type SimilarLicensesQuery,
  type UpdateLicenseInput,
  type UsageType,
} from "@workspace/shared"
import { api } from "@/lib/api"

const KEY = ["licenses"]

export function useLicenses(query: LicenseListQuery = {}) {
  return useQuery({
    queryKey: [...KEY, query],
    queryFn: () => api("/licenses", { query, schema: z.array(LicenseSchema) }),
  })
}

export function useLicense(id: string) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => api(`/licenses/${id}`, { schema: LicenseDetailSchema }),
  })
}

function useInvalidateLedger() {
  const queryClient = useQueryClient()
  // License mutations ripple into invoices, dashboard, and track rollups.
  return () =>
    Promise.all(
      ["licenses", "invoices", "dashboard", "tracks"].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] })
      )
    )
}

export function useCreateLicense() {
  const invalidate = useInvalidateLedger()
  return useMutation({
    mutationFn: (input: CreateLicenseInput) =>
      api<LicenseDetailDto>("/licenses", {
        method: "POST",
        body: input,
        schema: LicenseDetailSchema,
      }),
    onSuccess: invalidate,
  })
}

export function useUpdateLicense(id: string) {
  const invalidate = useInvalidateLedger()
  return useMutation({
    mutationFn: (input: UpdateLicenseInput) =>
      api<LicenseDetailDto>(`/licenses/${id}`, {
        method: "PATCH",
        body: input,
        schema: LicenseDetailSchema,
      }),
    onSuccess: invalidate,
  })
}

export function useSetRenewedTo(id: string) {
  const invalidate = useInvalidateLedger()
  return useMutation({
    mutationFn: (renewedToId: string | null) =>
      api<LicenseDetailDto>(`/licenses/${id}/renewed-to`, {
        method: "PATCH",
        body: { renewedToId },
        schema: LicenseDetailSchema,
      }),
    onSuccess: invalidate,
  })
}

/** Advisory exclusivity collision check — fires once the form has the trio. */
export function useCollisions(query: Partial<CollisionCheckQuery>) {
  const complete = Boolean(
    query.trackId && query.brandId && query.exclusivityTier
  )
  return useQuery({
    queryKey: ["collisions", query],
    queryFn: () =>
      api("/licenses/collisions", {
        query: query as Record<string, string>,
        schema: CollisionCheckResultSchema,
      }),
    enabled: complete,
  })
}

/** "Similar Past Licenses" pricing reference for the form side panel. The usage
 *  set is sent as a CSV param ("broadcast,social_media") and matched by overlap
 *  server-side (ADR-0004). */
export function useSimilarLicenses(
  query: Partial<Omit<SimilarLicensesQuery, "usageTypes">> & {
    usageTypes?: UsageType[]
  }
) {
  const complete = Boolean(
    query.usageTypes?.length && query.exclusivityTier && query.termLength
  )
  return useQuery({
    queryKey: ["similar-licenses", query],
    queryFn: () =>
      api("/licenses/similar", {
        query: {
          usageTypes: query.usageTypes?.join(","),
          exclusivityTier: query.exclusivityTier,
          termLength: query.termLength,
          trackId: query.trackId,
        },
        schema: SimilarLicensesResultSchema,
      }),
    enabled: complete,
  })
}
