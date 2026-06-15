import type { Metadata } from "next"
import { Archivo_Black, IBM_Plex_Mono } from "next/font/google"

import "@workspace/ui/globals.css"
import { Providers } from "@/components/providers"
import { cn } from "@workspace/ui/lib/utils"

// The entire UI is set in IBM Plex Mono (the ledger voice); Archivo Black is
// reserved for display headings via --font-archivo / font-heading.
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
})

const archivoBlack = Archivo_Black({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-archivo",
})

export const metadata: Metadata = {
  title: "CHARLIE FOLTZ | LICENSE MANAGER",
  description: "Ledger for licenses, demos, invoices, and payments.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        "font-sans",
        plexMono.variable,
        archivoBlack.variable
      )}
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
