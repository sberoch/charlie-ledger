import type { ZodType } from "zod"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly issues?: Array<{ path: string; message: string }>
  ) {
    super(message)
  }
}

interface RequestOptions<T> {
  method?: "GET" | "POST" | "PATCH" | "DELETE"
  body?: unknown
  query?: Record<string, string | number | boolean | undefined>
  /** Responses are runtime-checked at the boundary — never trusted blindly. */
  schema?: ZodType<T>
}

export async function api<T>(
  path: string,
  { method = "GET", body, query, schema }: RequestOptions<T> = {}
): Promise<T> {
  const url = new URL(path, BASE_URL)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== "")
      url.searchParams.set(key, String(value))
  }

  const res = await fetch(url, {
    method,
    credentials: "include",
    headers:
      body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const payload = await res.json().catch(() => null)
    throw new ApiError(
      res.status,
      payload?.message ?? `Request failed (${res.status})`,
      payload?.issues
    )
  }

  const data: unknown = await res.json()
  return schema ? schema.parse(data) : (data as T)
}

/** Authenticated file download (PDF/CSV) — opens the browser save flow.
 *  Pass a domain-based `filename` (e.g. "INV-0046.pdf"); it wins over whatever
 *  the server's Content-Disposition advertises and the URL fallback, so the
 *  saved file is never the bare "pdf" the path's last segment would yield. */
export async function downloadFile(
  path: string,
  filename?: string
): Promise<void> {
  const res = await fetch(new URL(path, BASE_URL), { credentials: "include" })
  if (!res.ok) throw new ApiError(res.status, `Download failed (${res.status})`)
  const disposition = res.headers.get("Content-Disposition") ?? ""
  const name =
    filename ??
    /filename="([^"]+)"/.exec(disposition)?.[1] ??
    path.split("?")[0]!.split("/").pop()!
  const blob = await res.blob()
  const href = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = href
  a.download = name
  a.click()
  URL.revokeObjectURL(href)
}
