import { describe, expect, it } from "vitest"
import {
  defaultDueDate,
  defaultEndDate,
  defaultHoldEndsAt,
  deriveInvoiceStatus,
  expirationState,
  formatInvoiceNumber,
} from "./derivations"
import { addMonths, daysBetween, formatMoney } from "./primitives"

const TODAY = "2026-06-12"

describe("expirationState", () => {
  it("is urgent strictly under 14 days", () => {
    expect(expirationState("2026-06-25", TODAY)).toEqual({
      urgency: "urgent",
      daysLeft: 13,
    })
  })

  it("is expiring_soon from 14 through 60 days", () => {
    expect(expirationState("2026-06-26", TODAY).urgency).toBe("expiring_soon")
    expect(expirationState("2026-08-11", TODAY)).toEqual({
      urgency: "expiring_soon",
      daysLeft: 60,
    })
  })

  it("is active beyond 60 days", () => {
    expect(expirationState("2026-08-12", TODAY).urgency).toBe("active")
  })

  it("is expired when past, with negative daysLeft", () => {
    expect(expirationState("2026-06-11", TODAY)).toEqual({
      urgency: "expired",
      daysLeft: -1,
    })
  })

  it("treats expiring today as urgent, not expired", () => {
    expect(expirationState(TODAY, TODAY).urgency).toBe("urgent")
  })

  it("perpetual (null end) is always active with null daysLeft", () => {
    expect(expirationState(null, TODAY)).toEqual({
      urgency: "active",
      daysLeft: null,
    })
  })
})

describe("deriveInvoiceStatus", () => {
  const base = { paidDate: null, dueDate: "2026-07-12", voidedAt: null }

  it("voided wins over everything", () => {
    expect(
      deriveInvoiceStatus(
        { ...base, paidDate: "2026-06-01", voidedAt: new Date() },
        TODAY
      )
    ).toBe("voided")
  })

  it("paid wins over overdue", () => {
    expect(
      deriveInvoiceStatus(
        { ...base, paidDate: "2026-06-01", dueDate: "2026-01-01" },
        TODAY
      )
    ).toBe("paid")
  })

  it("overdue strictly after due date", () => {
    expect(deriveInvoiceStatus({ ...base, dueDate: "2026-06-11" }, TODAY)).toBe(
      "overdue"
    )
    expect(deriveInvoiceStatus({ ...base, dueDate: TODAY }, TODAY)).toBe(
      "unpaid"
    )
  })
})

describe("formatInvoiceNumber", () => {
  it("pads to four digits and grows past 9999", () => {
    expect(formatInvoiceNumber(46)).toBe("INV-0046")
    expect(formatInvoiceNumber(12345)).toBe("INV-12345")
  })
})

describe("seeded dates", () => {
  it("end date follows the term", () => {
    expect(defaultEndDate("2026-05-15", "one_year")).toBe("2027-05-15")
    expect(defaultEndDate("2026-05-15", "six_months")).toBe("2026-11-15")
    expect(defaultEndDate("2026-05-15", "perpetual")).toBeNull()
  })

  it("clamps month-end overflow", () => {
    expect(addMonths("2026-08-31", 6)).toBe("2027-02-28")
  })

  it("hold ends at written date when no hold", () => {
    expect(defaultHoldEndsAt("2026-06-01", "none")).toBe("2026-06-01")
    expect(defaultHoldEndsAt("2026-06-01", "three_months")).toBe("2026-09-01")
  })

  it("due date is Net 30", () => {
    expect(defaultDueDate("2026-06-12")).toBe("2026-07-12")
  })
})

describe("primitives", () => {
  it("daysBetween is signed", () => {
    expect(daysBetween("2026-06-12", "2026-06-19")).toBe(7)
    expect(daysBetween("2026-06-12", "2026-06-05")).toBe(-7)
  })

  it("formatMoney drops cents when whole", () => {
    expect(formatMoney("24500.00")).toBe("$24,500")
    expect(formatMoney("4800.50")).toBe("$4,800.50")
  })
})
