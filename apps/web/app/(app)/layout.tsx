"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { LoadingSpinner } from "@workspace/ui/components/loading-spinner"
import { AppSidebar } from "@/components/shell/app-sidebar"
import { Fab } from "@/components/shell/fab"
import { TabBar } from "@/components/shell/tab-bar"
import { useSession } from "@/lib/auth-client"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (!isPending && !session) router.replace("/sign-in")
  }, [isPending, session, router])

  if (isPending || !session) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="flex min-h-svh">
      <AppSidebar />
      <main className="min-w-0 flex-1 px-4 pt-6 pb-[calc(96px+env(safe-area-inset-bottom))] md:px-10 md:pt-8 md:pb-16">
        {children}
      </main>
      <TabBar />
      <Fab />
    </div>
  )
}
