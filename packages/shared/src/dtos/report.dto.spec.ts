import { describe, expect, it } from "vitest"
import { ReportQuerySchema } from "./report.dto"

const BASE = { from: "2026-01-01", to: "2026-12-31", groupBy: "brand" }

describe("ReportQuerySchema", () => {
  it("defaults to the commitment basis", () => {
    expect(ReportQuerySchema.parse(BASE).basis).toBe("commitment")
  })

  it("accepts an explicit cash basis", () => {
    expect(ReportQuerySchema.parse({ ...BASE, basis: "cash" }).basis).toBe(
      "cash"
    )
  })

  it("rejects an unknown basis", () => {
    expect(
      ReportQuerySchema.safeParse({ ...BASE, basis: "accrual" }).success
    ).toBe(false)
  })

  it("still coerces the query-string includeLeads flag", () => {
    expect(
      ReportQuerySchema.parse({ ...BASE, includeLeads: "true" }).includeLeads
    ).toBe(true)
    expect(ReportQuerySchema.parse(BASE).includeLeads).toBe(false)
  })
})
