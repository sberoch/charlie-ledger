"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/auth-client";

export default function SignInPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(mode: "in" | "up") {
    setError(null);
    const res =
      mode === "up"
        ? await signUp.email({ email, password, name })
        : await signIn.email({ email, password });
    if (res.error) setError(res.error.message ?? "Failed");
    else router.push("/protected");
  }

  return (
    <main style={{ maxWidth: 320, margin: "4rem auto", display: "grid", gap: 8 }}>
      <h1>Sign in</h1>
      <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input
        placeholder="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button onClick={() => submit("up")}>Sign up</button>
      <button onClick={() => submit("in")}>Sign in</button>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </main>
  );
}
