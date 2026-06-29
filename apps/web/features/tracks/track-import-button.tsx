"use client"

import { useRef, useState } from "react"
import Papa from "papaparse"
import { toast } from "sonner"
import { Button } from "@workspace/ui/components/button"
import { useImportTracks } from "./hooks"

// Disco's metadata export carries the track name in this exact column, and a
// comma-separated grab-bag of descriptors (moods, genres, instruments, junk) in
// COMMENTS. We send every distinct word from COMMENTS as a candidate; the server
// keeps only those matching the curated mood vocabulary (it never mints tags).
const TITLE_COLUMN = "TRACKTITLE"
const TAGS_COLUMN = "COMMENTS"

// Split the COMMENTS cell into distinct lowercased words. Splitting on
// whitespace (not just commas) recovers moods the export glued onto junk without
// a delimiter — e.g. "Uplifting Easy-clear" → ["uplifting", "easy-clear"].
function candidateWords(comments: string): string[] {
  const words = new Set<string>()
  for (const chunk of comments.split(",")) {
    for (const word of chunk.trim().split(/\s+/)) {
      const w = word.toLowerCase()
      if (w) words.add(w)
    }
  }
  return [...words]
}

/**
 * Bulk import from a Disco CSV export (CONTEXT.md "Track import"). The file is
 * parsed entirely in the browser — Papaparse handles the quoted, comma-laden
 * COMMENTS column a naive split would corrupt — and only a clean array of track
 * DTOs is POSTed. Best-effort dedupe (case-insensitive, file + catalog) happens
 * server-side; we dedupe here too so the payload stays small. All bad-file
 * cases fail loud client-side before any request is made.
 */
export function TrackImportButton() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [parsing, setParsing] = useState(false)
  const importTracks = useImportTracks()
  const busy = parsing || importTracks.isPending

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Reset immediately so picking the same file again re-fires onChange.
    e.target.value = ""
    if (!file) return

    setParsing(true)
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        setParsing(false)

        if (!result.meta.fields?.includes(TITLE_COLUMN)) {
          toast.error(
            `This file has no ${TITLE_COLUMN} column — is it a Disco metadata export?`
          )
          return
        }

        // Trim, drop blanks, dedupe case-insensitively (first spelling wins),
        // carrying each track's candidate tag words from COMMENTS.
        const byKey = new Map<string, { name: string; tags: string[] }>()
        for (const row of result.data) {
          const name = (row[TITLE_COLUMN] ?? "").trim()
          if (!name) continue
          const key = name.toLowerCase()
          if (!byKey.has(key))
            byKey.set(key, { name, tags: candidateWords(row[TAGS_COLUMN] ?? "") })
        }
        const tracks = [...byKey.values()]
        if (tracks.length === 0) {
          toast.error("No track titles found in this file.")
          return
        }

        importTracks.mutate(
          { tracks },
          {
            onSuccess: ({ imported, skipped }) => {
              if (imported.length === 0) {
                toast.success(
                  `Nothing new — all ${skipped.length} titles already in your catalog.`
                )
                return
              }
              const skip = skipped.length
                ? `, skipped ${skipped.length} duplicate${skipped.length === 1 ? "" : "s"}`
                : ""
              toast.success(
                `Imported ${imported.length} track${imported.length === 1 ? "" : "s"}${skip}.`
              )
            },
            onError: (err) => toast.error(err.message),
          }
        )
      },
      error: (err) => {
        setParsing(false)
        toast.error(`Couldn't read that file: ${err.message}`)
      },
    })
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={onFile}
      />
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? "Importing…" : "Import"}
      </Button>
    </>
  )
}
