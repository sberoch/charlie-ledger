import { z } from "zod"

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  image: z.string().nullable(),
})
export type UserDto = z.infer<typeof UserSchema>

export const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  image: z.string().url().optional(),
})
export type UpdateUserDto = z.infer<typeof UpdateUserSchema>
