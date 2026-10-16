"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/input";
import { login, logout, useAdminSession, verifyCode } from "@/lib/admin/session";
import { ErrorNote } from "./ui";

export function LoginView() {
  const router = useRouter();
  const status = useAdminSession((s) => s.status);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === "ready") router.replace("/admin");
  }, [status, router]);

  async function onPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const r = await login(String(f.get("username") ?? ""), String(f.get("password") ?? ""));
    setBusy(false);
    if (!r.ok) setError(r.message);
  }

  async function onCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await verifyCode(String(new FormData(e.currentTarget).get("code") ?? ""));
    setBusy(false);
    if (!r.ok) setError(r.message ?? "That code didn't work.");
  }

  return (
    <div className="grid gap-6">
      <div>
        <p className="font-heading text-step-0 font-extrabold tracking-[-0.02em]">KITTORA Admin</p>
        <h1 className="mt-2 text-step-3 font-bold">{status === "needs-code" ? "Enter your code" : "Sign in"}</h1>
      </div>
      {error && <ErrorNote message={error} />}
      {status === "needs-code" ? (
        <form onSubmit={onCode} className="grid gap-4">
          <TextField
            label="6-digit code from your authenticator app"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            required
            autoFocus
          />
          <Button type="submit" size="lg" loading={busy}>
            Verify
          </Button>
          <button type="button" onClick={() => void logout()} className="text-step-n1 text-ink-muted underline underline-offset-4">
            Use a different account
          </button>
        </form>
      ) : (
        <form onSubmit={onPassword} className="grid gap-4">
          <TextField label="Username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required />
          <TextField label="Password" name="password" type="password" autoComplete="current-password" required />
          <Button type="submit" size="lg" loading={busy || status === "loading"}>
            Sign in
          </Button>
        </form>
      )}
    </div>
  );
}
