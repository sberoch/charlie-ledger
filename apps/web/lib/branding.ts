// Demo mode swaps Charlie's identity for a fictional persona so the app can be
// screen-recorded for people other than Charlie. Toggled with
// NEXT_PUBLIC_DEMO_MODE=true (inlined at build time — for local recording, set
// it before starting the dev server). Mirrors the API-side branding in
// apps/api/src/common/branding.ts.
const DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true"

/** Owner name for the sidebar header and the page <title>. */
export const OWNER_NAME = DEMO ? "JOHN DOE" : "CHARLIE FOLTZ"

/**
 * The "logged in as" email shown in the sidebar. In demo mode we mask the real
 * session email (e.g. the admin account) with the persona's address so the
 * whole sidebar block reads as the fictional owner.
 */
export function displayEmail(sessionEmail: string | undefined): string {
  if (DEMO) return "john@riverstonemedia.com"
  return sessionEmail ?? "…"
}
