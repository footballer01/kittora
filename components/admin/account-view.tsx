"use client";

import { useState } from "react";
import { db, logout } from "@/lib/admin/session";
import { toast } from "@/lib/stores/toast";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/input";
import { Card, ErrorNote, Loading, PageHeader, useLoad } from "./ui";

// Optional two-factor sign-in (TOTP: Google Authenticator, Authy, 1Password…),
// one per admin, handled by Supabase Auth. Once on, Postgres treats this
// account as admin only after a code (is_admin() checks the session level).

type Factor = { id: string; status: string; friendly_name?: string };

async function loadFactors(): Promise<Factor[]> {
  const { data, error } = await (await db()).auth.mfa.listFactors();
  if (error) throw new Error(error.message);
  return data.all.filter((f) => f.factor_type === "totp") as Factor[];
}

export function AccountView() {
  const factors = useLoad(loadFactors);
  const [setup, setSetup] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  if (factors.error) return <ErrorNote message={factors.error} onRetry={factors.reload} />;
  if (!factors.data) return <Loading />;
  const verified = factors.data.find((f) => f.status === "verified");

  async function start() {
    setBusy(true);
    const client = await db();
    // Clear any half-finished setup first.
    for (const f of factors.data!.filter((x) => x.status !== "verified")) await client.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: `KITTORA ${new Date().toISOString().slice(0, 10)}` });
    setBusy(false);
    if (error) return toast(error.message, "warning");
    setSetup({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function confirm() {
    if (!setup) return;
    setBusy(true);
    const { error } = await (await db()).auth.mfa.challengeAndVerify({ factorId: setup.id, code: code.replace(/\s/g, "") });
    setBusy(false);
    if (error) return toast("That code didn't work. Use the newest code in the app.", "warning");
    toast("Two-factor sign-in is on.", "success");
    setSetup(null);
    setCode("");
    factors.reload();
  }

  async function turnOff(id: string) {
    if (!window.confirm("Turn off two-factor sign-in for your account?")) return;
    const { error } = await (await db()).auth.mfa.unenroll({ factorId: id });
    if (error) return toast(error.message, "warning");
    toast("Two-factor sign-in is off.", "success");
    factors.reload();
  }

  return (
    <>
      <PageHeader title="Account" />
      <Card title="Two-factor sign-in">
        {verified ? (
          <div className="grid gap-3">
            <p className="text-success">On. You&apos;ll enter a code from your authenticator app each time you sign in.</p>
            <Button variant="secondary" size="lg" className="w-full sm:w-auto" onClick={() => void turnOff(verified.id)}>
              Turn off
            </Button>
          </div>
        ) : setup ? (
          <div className="grid gap-4">
            <ol className="grid list-decimal gap-2 pl-5 text-step-n1">
              <li>Open an authenticator app (Google Authenticator, Authy, 1Password…).</li>
              <li>Scan this code, or type the key below.</li>
              <li>Enter the 6-digit code the app shows.</li>
            </ol>
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG data URL from Supabase Auth */}
            <img src={setup.qr} alt="Two-factor setup QR code" className="size-48 rounded-xl bg-white p-2" />
            <p className="font-mono text-step-n1 break-all select-all">{setup.secret}</p>
            <TextField label="6-digit code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
            <div className="grid gap-2 sm:flex">
              <Button size="lg" loading={busy} onClick={() => void confirm()}>
                Turn on
              </Button>
              <Button variant="ghost" size="lg" onClick={() => setSetup(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            <p className="text-step-n1 text-ink-muted">Off. Turn it on so a stolen password alone can&apos;t open admin.</p>
            <Button size="lg" loading={busy} className="w-full sm:w-auto" onClick={() => void start()}>
              Set up two-factor
            </Button>
          </div>
        )}
      </Card>
      <Card title="Sign out">
        <Button variant="secondary" size="lg" className="w-full sm:w-auto" onClick={() => void logout()}>
          Sign out on this device
        </Button>
      </Card>
    </>
  );
}
