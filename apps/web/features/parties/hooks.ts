"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import {
  BrandCategorySchema,
  BrandSchema,
  PayerSchema,
  type BrandDto,
  type BrandCategoryDto,
  type CreateBrandInput,
  type CreatePayerInput,
  type PayerDto,
  type UpdateBrandInput,
  type UpdatePayerInput,
} from "@workspace/shared"
import { api } from "@/lib/api"

export function useBrands() {
  return useQuery({
    queryKey: ["brands"],
    queryFn: () => api("/brands", { schema: z.array(BrandSchema) }),
  })
}

export function useCategories() {
  return useQuery({
    queryKey: ["brand-categories"],
    queryFn: () =>
      api("/brand-categories", { schema: z.array(BrandCategorySchema) }),
  })
}

export function usePayers() {
  return useQuery({
    queryKey: ["payers"],
    queryFn: () => api("/payers", { schema: z.array(PayerSchema) }),
  })
}

export function useCreateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) =>
      api<BrandCategoryDto>("/brand-categories", {
        method: "POST",
        body: { name },
        schema: BrandCategorySchema,
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["brand-categories"] }),
  })
}

export function useCreateBrand() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateBrandInput) =>
      api<BrandDto>("/brands", {
        method: "POST",
        body: input,
        schema: BrandSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["brands"] }),
  })
}

export function useCreatePayer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreatePayerInput) =>
      api<PayerDto>("/payers", {
        method: "POST",
        body: input,
        schema: PayerSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payers"] }),
  })
}

export function useUpdateBrand() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateBrandInput & { id: string }) =>
      api<BrandDto>(`/brands/${id}`, {
        method: "PATCH",
        body: input,
        schema: BrandSchema,
      }),
    onSuccess: () => {
      // A brand's name/category is denormalized into license rows and the
      // dashboard's per-category rollups.
      void queryClient.invalidateQueries({ queryKey: ["brands"] })
      void queryClient.invalidateQueries({ queryKey: ["licenses"] })
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}

export function useUpdatePayer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: UpdatePayerInput & { id: string }) =>
      api<PayerDto>(`/payers/${id}`, {
        method: "PATCH",
        body: input,
        schema: PayerSchema,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payers"] }),
  })
}
