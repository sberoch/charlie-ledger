"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import {
  CreateDemoSchema,
  HOLD_PERIOD_LABELS,
  defaultHoldEndsAt,
  formatInvoiceNumber,
  todayIso,
  type CreateDemoInput,
  type DemoDto,
} from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import { SegControl } from "@/components/seg-control"
import { BrandPicker, PayerPicker } from "@/features/parties/pickers"
import { useCreateDemo, useUpdateDemo } from "./hooks"

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

export function DemoForm({ existing }: { existing?: DemoDto }) {
  const router = useRouter()
  const createDemo = useCreateDemo()
  const updateDemo = useUpdateDemo(existing?.id ?? "")
  const [holdTouched, setHoldTouched] = useState(false)

  const form = useForm<CreateDemoInput>({
    resolver: zodResolver(CreateDemoSchema),
    defaultValues: existing
      ? {
          brandId: existing.brandId,
          payerId: existing.payerId,
          fee: existing.fee,
          workingName: existing.workingName,
          holdPeriod: existing.holdPeriod,
          writtenAt: existing.writtenAt,
          holdEndsAt: existing.holdEndsAt,
          notes: existing.notes,
          terms: existing.terms,
        }
      : {
          writtenAt: todayIso(),
          issueDate: todayIso(),
          fee: "",
          workingName: "",
        },
  })
  const values = form.watch()

  const seedHoldEnd = (
    writtenAt: string,
    hold: CreateDemoInput["holdPeriod"]
  ) => {
    if (!holdTouched && writtenAt && hold)
      form.setValue("holdEndsAt", defaultHoldEndsAt(writtenAt, hold))
  }

  const onSubmit = form.handleSubmit(async (input) => {
    try {
      if (existing) {
        await updateDemo.mutateAsync(input)
        toast.success("Demo updated")
        router.push(`/demos/${existing.id}`)
      } else {
        const created = await createDemo.mutateAsync(input)
        toast.success(
          `Demo logged — Invoice ${formatInvoiceNumber(created.invoice.number)} issued`
        )
        router.push(`/demos/${created.id}`)
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Something went wrong"
      )
    }
  })

  return (
    <form onSubmit={onSubmit} className="mx-auto">
      <Field
        label="Working Name"
        hint="The pitch filename (e.g. Walmart_SpringSale_v1a)."
      >
        <Input
          placeholder="Brand_Spot_v1"
          value={values.workingName ?? ""}
          onChange={(e) =>
            form.setValue("workingName", e.target.value, {
              shouldValidate: true,
            })
          }
        />
      </Field>

      <Field label="Brand" hint="Who the cue is pitched for.">
        <BrandPicker
          value={values.brandId || null}
          onChange={(brand) =>
            form.setValue("brandId", brand?.id ?? "", { shouldValidate: true })
          }
        />
      </Field>

      <Field
        label="Music House (Payer)"
        hint="Who commissioned it and gets the invoice."
      >
        <PayerPicker
          value={values.payerId || null}
          onChange={(payer) =>
            form.setValue("payerId", payer?.id ?? "", { shouldValidate: true })
          }
        />
      </Field>

      <Field label="Fee">
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[13px] text-muted-foreground">
            $
          </span>
          <Input
            inputMode="decimal"
            placeholder="3500"
            value={values.fee ?? ""}
            onChange={(e) =>
              form.setValue("fee", e.target.value.replaceAll(",", ""), {
                shouldValidate: true,
              })
            }
            className="pl-7"
          />
        </div>
      </Field>

      <Field
        label="Hold"
        hint="The wait before this idea can become a library track."
      >
        <SegControl
          options={(
            Object.entries(HOLD_PERIOD_LABELS) as Array<
              [CreateDemoInput["holdPeriod"], string]
            >
          ).map(([value, label]) => ({ value, label }))}
          value={values.holdPeriod}
          onChange={(v) => {
            form.setValue("holdPeriod", v, { shouldValidate: true })
            seedHoldEnd(values.writtenAt, v)
          }}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Written">
          <Input
            type="date"
            value={values.writtenAt ?? ""}
            onChange={(e) => {
              form.setValue("writtenAt", e.target.value, {
                shouldValidate: true,
              })
              seedHoldEnd(e.target.value, values.holdPeriod)
            }}
          />
        </Field>
        <Field label={holdTouched ? "Hold Lifts" : "Hold Lifts · Auto"}>
          <Input
            type="date"
            value={values.holdEndsAt ?? ""}
            onChange={(e) => {
              setHoldTouched(true)
              form.setValue("holdEndsAt", e.target.value || undefined)
            }}
            className={holdTouched ? undefined : "text-muted-foreground"}
          />
        </Field>
      </div>

      {!existing ? (
        <Field
          label="Invoice Issue Date"
          hint="The born invoice's date — backdate when logging an older demo (due defaults to issue + 30). Editable later on the invoice itself."
        >
          <Input
            type="date"
            value={values.issueDate ?? ""}
            onChange={(e) =>
              form.setValue("issueDate", e.target.value || undefined)
            }
          />
        </Field>
      ) : null}

      <Field label="Invoice terms">
        <Textarea
          placeholder="Grant scope printed on the invoice. Leave blank for an auto-generated line."
          value={values.terms ?? ""}
          onChange={(e) => form.setValue("terms", e.target.value || null)}
          rows={4}
        />
      </Field>

      <Field label="Notes">
        <Textarea
          placeholder="Internal notes (optional)…"
          value={values.notes ?? ""}
          onChange={(e) => form.setValue("notes", e.target.value || null)}
          rows={2}
        />
      </Field>

      <div className="flex items-center justify-end gap-2.5 border-t pt-5">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={
            createDemo.isPending ||
            updateDemo.isPending ||
            !form.formState.isValid
          }
        >
          {existing ? "Save changes" : "Create demo"}
        </Button>
      </div>
    </form>
  )
}
