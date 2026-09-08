import { z } from "zod"
import { MoneySchema, UuidSchema } from "../domain/primitives"

// Album — the library release a Track was ingested under; a platform-owned
// lookup managed from Settings (same shape as Tag) and picked-or-created from
// the Track form. Each row carries its lifetime money so the Tracks list's
// album summary strip and the Settings panel read one query. Both figures
// count archived tracks — history does not move. See CONTEXT.md ("Album").

export const AlbumSchema = z.object({
  id: UuidSchema,
  name: z.string(),
  trackCount: z.number().int(),
  /** Σ License fees over the album's tracks, lifetime, commitment basis. */
  lifetimeSales: MoneySchema,
  /** Σ royalty payments attributed to the album's tracks, lifetime. */
  lifetimeRoyalties: MoneySchema,
})
export type AlbumDto = z.infer<typeof AlbumSchema>

export const CreateAlbumSchema = z.object({
  name: z.string().trim().min(1).max(120),
})
export type CreateAlbumInput = z.infer<typeof CreateAlbumSchema>

export const RenameAlbumSchema = CreateAlbumSchema

/** Tracks-list `album` filter value meaning "tracks with no album" — a
 *  sentinel no real album name can collide with (names are trimmed, and
 *  Settings never lets one start with "__"). */
export const NO_ALBUM_FILTER = "__none__"
