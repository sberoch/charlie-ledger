"use client"

import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import {
  CreateTrackSchema,
  type CreateTrackInput,
  type TrackDetailDto,
} from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { useCreateTrack, useUpdateTrack } from "./hooks"
import { TagMultiSelect } from "./tag-multi-select"

function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <div className="mb-5">
      <label className="mb-2 block text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </label>
      {children}
      {hint ? (
        <p className="mt-1.5 text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

export function TrackForm({
  existing,
}: {
  /** Present = edit mode. */
  existing?: TrackDetailDto
}) {
  const router = useRouter()
  const createTrack = useCreateTrack()
  const updateTrack = useUpdateTrack(existing?.id ?? "")

  const form = useForm<CreateTrackInput>({
    resolver: zodResolver(CreateTrackSchema),
    defaultValues: existing
      ? { name: existing.name, tags: existing.tags }
      : { name: "", tags: [] },
  })
  const values = form.watch()

  const onSubmit = form.handleSubmit(async (input) => {
    try {
      if (existing) {
        await updateTrack.mutateAsync(input)
        toast.success("Track updated")
        router.push(`/tracks/${existing.id}`)
      } else {
        const created = await createTrack.mutateAsync(input)
        toast.success("Track created")
        router.push(`/tracks/${created.id}`)
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Something went wrong"
      )
    }
  })

  const pending = createTrack.isPending || updateTrack.isPending

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-xl">
      <Field label="Name">
        <Input
          autoFocus
          placeholder="Track name"
          value={values.name ?? ""}
          onChange={(e) =>
            form.setValue("name", e.target.value, { shouldValidate: true })
          }
        />
      </Field>

      <Field
        label="Tags"
        hint="Pick from the catalog vocabulary, or type a new one to create it."
      >
        <TagMultiSelect
          value={values.tags ?? []}
          onChange={(tags) => form.setValue("tags", tags, { shouldValidate: true })}
        />
      </Field>

      <div className="flex items-center justify-end gap-2.5 border-t pt-5">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || !form.formState.isValid}>
          {existing ? "Save changes" : "Create track"}
        </Button>
      </div>
    </form>
  )
}
