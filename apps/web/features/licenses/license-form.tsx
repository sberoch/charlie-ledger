"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import {
  CreateLicenseSchema,
  EXCLUSIVITY_TIER_LABELS,
  EXCLUSIVITY_TIER_SHORT,
  ExclusivityTierSchema,
  TERM_LENGTH_LABELS,
  TermLengthSchema,
  USAGE_TYPE_LABELS,
  UsageTypeSchema,
  defaultEndDate,
  formatInvoiceNumber,
  formatMoney,
  todayIso,
  type CreateLicenseInput,
  type LicenseDetailDto,
} from "@workspace/shared"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import { SegControl } from "@/components/seg-control"
import { MultiSegControl } from "@/components/multi-seg-control"
import { EntityCombobox } from "@/features/parties/entity-combobox"
import { BrandPicker, PayerPicker } from "@/features/parties/pickers"
import { useTracks } from "@/features/tracks/hooks"
import { formatDate } from "@/lib/format"
import {
  useCollisions,
  useCreateLicense,
  useSimilarLicenses,
  useUpdateLicense,
} from "./hooks"

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

const enumOptions = <T extends string>(labels: Record<T, string>) =>
  (Object.entries(labels) as Array<[T, string]>).map(([value, label]) => ({
    value,
    label,
  }))

export function LicenseForm({
  existing,
  initialTrackId,
}: {
  /** Present = edit mode. */
  existing?: LicenseDetailDto
  initialTrackId?: string
}) {
  const router = useRouter()
  const { data: tracks = [] } = useTracks()
  const createLicense = useCreateLicense()
  const updateLicense = useUpdateLicense(existing?.id ?? "")

  const [brandName, setBrandName] = useState<string | undefined>(
    existing?.brandName
  )
  // End date is auto-seeded from start + term until the user touches it. In
  // edit mode, an end date that already diverges from the seeded value was
  // set by hand — treat it as touched so start/term edits don't clobber it.
  const [endTouched, setEndTouched] = useState(
    existing
      ? existing.endDate !==
          defaultEndDate(existing.startDate, existing.termLength)
      : false
  )

  const form = useForm<CreateLicenseInput>({
    resolver: zodResolver(CreateLicenseSchema),
    defaultValues: existing
      ? {
          trackId: existing.trackId,
          brandId: existing.brandId,
          payerId: existing.payerId,
          usageTypes: existing.usageTypes,
          exclusivityTier: existing.exclusivityTier,
          termLength: existing.termLength,
          fee: existing.fee,
          startDate: existing.startDate,
          endDate: existing.endDate,
          notes: existing.notes,
          terms: existing.terms,
        }
      : {
          trackId: initialTrackId ?? "",
          usageTypes: [],
          startDate: todayIso(),
          fee: "",
        },
  })
  const values = form.watch()

  const seedEnd = (
    startDate: string,
    term: CreateLicenseInput["termLength"]
  ) => {
    if (!endTouched && startDate && term)
      form.setValue("endDate", defaultEndDate(startDate, term))
  }

  const { data: collisionData } = useCollisions({
    trackId: values.trackId || undefined,
    brandId: values.brandId || undefined,
    exclusivityTier: values.exclusivityTier,
    excludeLicenseId: existing?.id,
  })
  const { data: similar } = useSimilarLicenses({
    usageTypes: values.usageTypes,
    exclusivityTier: values.exclusivityTier,
    termLength: values.termLength,
    trackId: values.trackId || undefined,
  })

  // Edit mode: surface snapshot divergence against the live invoice.
  const diverged = useMemo(() => {
    if (!existing) return false
    return (
      Number(values.fee || 0) !== Number(existing.invoice.amount) ||
      values.payerId !== existing.payerId ||
      (values.terms ?? null) !== existing.terms
    )
  }, [existing, values.fee, values.payerId, values.terms])

  const onSubmit = form.handleSubmit(async (input) => {
    try {
      if (existing) {
        await updateLicense.mutateAsync(input)
        toast.success("License updated")
        router.push(`/licenses/${existing.id}`)
      } else {
        const created = await createLicense.mutateAsync(input)
        toast.success(
          `License created — Invoice ${formatInvoiceNumber(created.invoice.number)} issued`
        )
        router.push(`/licenses/${created.id}`)
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Something went wrong"
      )
    }
  })

  const pending = createLicense.isPending || updateLicense.isPending

  return (
    <form onSubmit={onSubmit} className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div>
        <Field label="Track">
          <EntityCombobox
            items={tracks.map((t) => ({
              id: t.id,
              name: t.name,
              meta: t.tags.slice(0, 2).join(", "),
            }))}
            value={values.trackId || null}
            onSelect={(item) =>
              form.setValue("trackId", item.id, { shouldValidate: true })
            }
            placeholder="Select track…"
            emptyHint="Tracks mirror Disco — new ones arrive via sync."
          />
        </Field>

        <Field label="Brand">
          <BrandPicker
            value={values.brandId || null}
            onChange={(brand) => {
              form.setValue("brandId", brand?.id ?? "", {
                shouldValidate: true,
              })
              setBrandName(brand?.name)
            }}
          />
        </Field>

        <Field
          label="Payer"
          hint="The bill-to on the invoice — snapshotted at creation."
        >
          <PayerPicker
            value={values.payerId || null}
            onChange={(payer) =>
              form.setValue("payerId", payer?.id ?? "", {
                shouldValidate: true,
              })
            }
            suggestedName={brandName}
          />
        </Field>

        <Field label="Usage Type" hint="One or more — pick every medium this grant covers.">
          <MultiSegControl
            options={enumOptions(USAGE_TYPE_LABELS).filter((o) =>
              UsageTypeSchema.options.includes(o.value)
            )}
            value={values.usageTypes ?? []}
            onChange={(v) =>
              form.setValue("usageTypes", v, { shouldValidate: true })
            }
          />
        </Field>

        <Field label="Term Length">
          <SegControl
            options={enumOptions(TERM_LENGTH_LABELS).filter((o) =>
              TermLengthSchema.options.includes(o.value)
            )}
            value={values.termLength}
            onChange={(v) => {
              form.setValue("termLength", v, { shouldValidate: true })
              if (v === "perpetual") form.setValue("endDate", null)
              else seedEnd(values.startDate, v)
            }}
          />
        </Field>

        <Field label="Exclusivity">
          <SegControl
            options={enumOptions(EXCLUSIVITY_TIER_LABELS).filter((o) =>
              ExclusivityTierSchema.options.includes(o.value)
            )}
            value={values.exclusivityTier}
            onChange={(v) =>
              form.setValue("exclusivityTier", v, { shouldValidate: true })
            }
          />
        </Field>

        {collisionData && collisionData.collisions.length > 0 ? (
          <div className="mb-5 border border-ochre bg-ochre-soft p-3.5">
            <div className="mb-1.5 text-[11px] font-semibold tracking-[0.12em] text-ochre uppercase">
              ⚠ Exclusivity conflict — advisory
            </div>
            <ul className="flex flex-col gap-1 text-xs leading-relaxed text-foreground">
              {collisionData.collisions.map((c) => (
                <li key={c.licenseId}>{c.message}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Start Date">
            <Input
              type="date"
              value={values.startDate ?? ""}
              onChange={(e) => {
                form.setValue("startDate", e.target.value, {
                  shouldValidate: true,
                })
                seedEnd(e.target.value, values.termLength)
              }}
            />
          </Field>
          <Field label={endTouched ? "End Date" : "End Date · Auto"}>
            <Input
              type="date"
              disabled={values.termLength === "perpetual"}
              value={values.endDate ?? ""}
              onChange={(e) => {
                setEndTouched(true)
                form.setValue("endDate", e.target.value || null)
              }}
              className={endTouched ? undefined : "text-muted-foreground"}
            />
          </Field>
        </div>

        <Field label="Fee">
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[13px] text-muted-foreground">
              $
            </span>
            <Input
              inputMode="decimal"
              placeholder="22000"
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

        <Field label="Invoice terms">
          <Textarea
            placeholder="Grant scope printed on the invoice (cuts, use/territories, term…). Leave blank for an auto-generated line."
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

        {diverged ? (
          <div className="mb-5 border border-rust bg-rust-soft p-3.5 text-xs leading-relaxed">
            <span className="font-semibold text-rust">
              Invoice {formatInvoiceNumber(existing!.invoice.number)} still
              shows the old terms.
            </span>{" "}
            Saving will not touch its snapshot — void &amp; reissue it from the
            invoice afterwards.
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2.5 border-t pt-5">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending || !form.formState.isValid}>
            {existing ? "Save changes" : "Create license"}
          </Button>
        </div>
      </div>

      {/* Similar Past Licenses — pricing reference (avg/range, no trend lines). */}
      <aside className="order-first h-fit border bg-background p-5 lg:order-none">
        <div className="mb-3.5 border-b border-border-soft pb-3 text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
          Similar Past Licenses
        </div>
        {!similar ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Pick usage, term, and exclusivity to see what comparable deals went
            for.
          </p>
        ) : similar.summary === null ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            No past licenses match this combination yet.
          </p>
        ) : (
          <>
            {similar.rows.map((row) => (
              <div
                key={row.licenseId}
                className="border-b border-border-soft py-3 text-[12.5px] last:border-0"
              >
                <span className="float-right font-semibold">
                  {formatMoney(row.fee)}
                </span>
                <div className="font-semibold">{row.brandName}</div>
                <div className="mt-0.5 text-[11px] tracking-[0.04em] text-muted-foreground uppercase">
                  {row.trackName} · {formatDate(row.startDate)}
                </div>
              </div>
            ))}
            <div className="mt-3.5 border-t pt-3.5 text-[12.5px] leading-relaxed text-ink-soft">
              Avg{" "}
              <strong className="text-foreground">
                {formatMoney(similar.summary.avg)}
              </strong>
              {" · "}Range{" "}
              <strong className="text-foreground">
                {formatMoney(similar.summary.min)} –{" "}
                {formatMoney(similar.summary.max)}
              </strong>
              <br />
              <span className="text-[11px] text-muted-foreground">
                {similar.summary.count} matching{" "}
                {EXCLUSIVITY_TIER_SHORT[values.exclusivityTier!]} deals
              </span>
            </div>
          </>
        )}
      </aside>
    </form>
  )
}
