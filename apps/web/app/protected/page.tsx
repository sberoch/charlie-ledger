"use client";

import { useSession, signOut } from "@/lib/auth-client";

export default function ProtectedPage() {
  const { data: session, isPending } = useSession();

  if (isPending) return <main style={{ maxWidth: 320, margin: "4rem auto" }}>Loading…</main>;
  if (!session)
    return (
      <main style={{ maxWidth: 320, margin: "4rem auto" }}>
        <p>
          Not signed in. <a href="/sign-in">Sign in</a>
        </p>
      </main>
    );

  return (
    <main style={{ maxWidth: 320, margin: "4rem auto", display: "grid", gap: 8 }}>
      <h1>Protected</h1>
      <pre>{JSON.stringify(session.user, null, 2)}</pre>
      <button onClick={() => signOut()}>Sign out</button>
    </main>
  );
}
