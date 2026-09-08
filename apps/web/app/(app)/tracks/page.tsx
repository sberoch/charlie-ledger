import { Suspense } from "react"
import { TracksPage } from "@/features/tracks/tracks-page"

// Suspense: TracksPage reads ?album= via useSearchParams (same as Settings).
export default function Page() {
  return (
    <Suspense>
      <TracksPage />
    </Suspense>
  )
}
