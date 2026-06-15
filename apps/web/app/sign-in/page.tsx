"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { signIn } from "@/lib/auth-client"

// Sign-in only by design — there is no self-signup; users are added from
// Settings by an existing user (developer brief).
export default function SignInPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const res = await signIn.email({ email, password })
    setPending(false)
    if (res.error) setError(res.error.message ?? "Sign in failed")
    else router.push("/dashboard")
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-sidebar px-4">
      <div className="w-full max-w-sm border bg-background p-7 md:p-9">
        <div className="font-heading text-2xl leading-none tracking-tight">
          CHARLIE FOLTZ
        </div>
        <div className="mt-2 mb-8 text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
          License manager · Sign in
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label className="mb-2 block text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
              Email
            </label>
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-2 block text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
              Password
            </label>
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error ? <p className="text-xs text-rust">{error}</p> : null}
          <Button
            type="submit"
            disabled={pending || !email || !password}
            className="mt-2"
          >
            Sign in
          </Button>
        </form>
      </div>
    </main>
  )
}
