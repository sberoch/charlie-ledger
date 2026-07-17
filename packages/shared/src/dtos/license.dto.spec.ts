import { describe, expect, it } from "vitest"
import {
  licenseTitle,
  licenseTrackLabel,
  TRACKLESS_LABEL,
} from "../domain/derivations"
import { licenseInvoiceDescription } from "./invoice.dto"
import {
  CreateLicenseSchema,
  TRACKLESS_REQUIRES_WFH_MESSAGE,
  UpdateLicenseSchema,
} from "./license.dto"

const TRACK_ID = "5b1f0c9a-8f2e-4d3b-9c6a-1e2f3a4b5c6d"

const BASE = {
  trackId: TRACK_ID,
  brandId: "6c2e1d0b-9a3f-4e4c-8d7b-2f3a4b5c6d7e",
  payerId: "7d3f2e1c-0b4a-4f5d-9e8c-3a4b5c6d7e8f",
  usageTypes: ["all_media"],
  exclusivityTier: "work_for_hire",
  termLength: "perpetual",
  fee: "1000.00",
  startDate: "2026-07-17",
}

describe("CreateLicenseSchema — trackless ⇒ work_for_hire (ADR-0013)", () => {
  it("accepts a trackless work_for_hire license", () => {
    expect(
      CreateLicenseSchema.safeParse({ ...BASE, trackId: null }).success
    ).toBe(true)
    expect(CreateLicenseSchema.safeParse({ ...BASE, trackId: undefined }).success).toBe(
      true
    )
  })

  it("rejects a trackless license on any other tier", () => {
    const result = CreateLicenseSchema.safeParse({
      ...BASE,
      trackId: null,
      exclusivityTier: "non_exclusive",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues[0]
      expect(issue?.message).toBe(TRACKLESS_REQUIRES_WFH_MESSAGE)
      expect(issue?.path).toEqual(["trackId"])
    }
  })

  it("still accepts a tracked license on every tier", () => {
    for (const tier of [
      "non_exclusive",
      "category_exclusive",
      "full_exclusive",
      "work_for_hire",
    ]) {
      expect(
        CreateLicenseSchema.safeParse({ ...BASE, exclusivityTier: tier })
          .success
      ).toBe(true)
    }
  })

  it("update stays a plain partial — the merged-row check is the service's", () => {
    expect(UpdateLicenseSchema.safeParse({ fee: "500.00" }).success).toBe(true)
    expect(UpdateLicenseSchema.safeParse({ trackId: null }).success).toBe(true)
  })
})

describe("trackless display identity", () => {
  it("falls back to the WFH label", () => {
    expect(licenseTrackLabel(null)).toBe(TRACKLESS_LABEL)
    expect(licenseTrackLabel(undefined)).toBe(TRACKLESS_LABEL)
    expect(licenseTrackLabel("Empire")).toBe("Empire")
    expect(licenseTitle(null, "Zyrtec")).toBe("WFH × Zyrtec")
    expect(licenseTitle("Empire", "Subaru")).toBe("Empire × Subaru")
  })

  it("composes the invoice fallback line without a track segment in quotes", () => {
    expect(
      licenseInvoiceDescription({
        trackName: null,
        brandName: "Zyrtec",
        usageTypes: ["all_media"],
        exclusivityTier: "work_for_hire",
      })
    ).toBe("Music license — WFH × Zyrtec · All Media · Work For Hire")
    expect(
      licenseInvoiceDescription({
        trackName: "Empire",
        brandName: "Subaru",
        usageTypes: ["broadcast"],
        exclusivityTier: "non_exclusive",
      })
    ).toBe('Music license — "Empire" × Subaru · Broadcast · Non-Exclusive')
  })

  it("grant terms still beat the composed line", () => {
    expect(
      licenseInvoiceDescription({
        trackName: null,
        brandName: "Zyrtec",
        usageTypes: ["all_media"],
        exclusivityTier: "work_for_hire",
        terms: "Zyrtec - Kill Fee",
      })
    ).toBe("Zyrtec - Kill Fee")
  })
})
