"use client";

import { create } from "zustand";

// Admin sign-in state. Passwords go to the admin-login Edge Function (rate
// limits, username → random email); two-factor codes go straight to Supabase
// Auth. Postgres decides who is admin (is_admin()), so nothing here is trusted.

export type AdminStatus = "loading" | "signed-out" | "needs-code" | "ready" | "off";
type State = { status: AdminStatus; userId: string | null };
export const useAdminSession = create<State>(() => ({ status: "loading", userId: null }));

const configured = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export async function db() {
  const { supabase } = await import("@/lib/supabase/client");
  return supabase();
}

/** Re-check the session with Postgres and Supabase Auth. */
export async function refreshAdmin(): Promise<AdminStatus> {
  if (!configured()) {
    useAdminSession.setState({ status: "off", userId: null });
    return "off";
  }
  const client = await db();
  const { data } = await client.auth.getSession();
  const session = data.session;
  let status: AdminStatus = "signed-out";
  if (session) {
    const { data: isAdmin } = await client.rpc("is_admin");
    if (isAdmin === true) status = "ready";
    else {
      const aal = await client.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal.data?.currentLevel === "aal1" && aal.data.nextLevel === "aal2") status = "needs-code";
      else await client.auth.signOut();
    }
  }
  useAdminSession.setState({ status, userId: status === "signed-out" ? null : (session?.user.id ?? null) });
  return status;
}

const LOGIN_ERRORS: Record<string, string> = {
  invalid: "That username and password don't match.",
  rate_limited: "Too many attempts. Wait 15 minutes, then try again.",
  network: "Couldn't reach the server. Check your connection.",
};

export async function login(username: string, password: string): Promise<{ ok: true; status: AdminStatus } | { ok: false; message: string }> {
  if (!configured()) return { ok: false, message: "Supabase isn't connected yet (see LAUNCH.md)." };
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      body: JSON.stringify({ username, password }),
    });
    const body = (await res.json().catch(() => ({}))) as { session?: { access_token: string; refresh_token: string }; error?: string };
    if (!body.session) return { ok: false, message: LOGIN_ERRORS[body.error ?? ""] ?? "Sign-in failed. Try again in a minute." };
    const { error } = await (await db()).auth.setSession(body.session);
    if (error) return { ok: false, message: LOGIN_ERRORS.invalid };
    return { ok: true, status: await refreshAdmin() };
  } catch {
    return { ok: false, message: LOGIN_ERRORS.network };
  }
}

/** Second step for admins with two-factor on. */
export async function verifyCode(code: string): Promise<{ ok: boolean; message?: string }> {
  const client = await db();
  const { data } = await client.auth.mfa.listFactors();
  const factor = data?.totp.find((f) => f.status === "verified");
  if (!factor) return { ok: false, message: "No authenticator is set up for this account." };
  const { error } = await client.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.replace(/\s/g, "") });
  if (error) return { ok: false, message: "That code didn't work. Codes change every 30 seconds — try the newest one." };
  await refreshAdmin();
  return { ok: true };
}

export async function logout() {
  await (await db()).auth.signOut();
  useAdminSession.setState({ status: "signed-out", userId: null });
}
