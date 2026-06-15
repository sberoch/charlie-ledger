import { describe, expect, it } from "vitest"
import { UpdateUserSchema, UserSchema } from "./user.dto"

describe("UserSchema", () => {
  it("accepts a valid user", () => {
    const user = { id: "1", name: "Ada", email: "ada@example.com", image: null }
    expect(UserSchema.parse(user)).toEqual(user)
  })

  it("rejects a malformed email", () => {
    const bad = { id: "1", name: "Ada", email: "not-an-email", image: null }
    expect(UserSchema.safeParse(bad).success).toBe(false)
  })
})

describe("UpdateUserSchema", () => {
  it("allows a partial update", () => {
    expect(UpdateUserSchema.parse({ name: "Grace" })).toEqual({ name: "Grace" })
  })
})
