"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { Button } from "@/components/ui/button";
import { publish, type DeployRun } from "@/lib/admin/api";
import { toast } from "@/lib/stores/toast";
import { timeAgo } from "./ui";

// "Publish changes": rebuilds the shop pages from the live catalogue (the
// Deploy workflow, via the publish Edge Function) and follows its progress.

type State = { run: DeployRun | null; busy: boolean; error: string | null; loaded: boolean };
const usePublish = create<State>(() => ({ run: null, busy: false, error: null, loaded: false }));

const ERRORS: Record<string, string> = {
  not_configured: "Publishing isn't set up yet (LAUNCH.md, Cloudflare step).",
  forbidden: "Your session has expired. Sign in again.",
  github_error: "GitHub didn't respond. Try again in a minute.",
};

let timer: ReturnType<typeof setTimeout> | undefined;
async function poll() {
  clearTimeout(timer);
  const r: Awaited<ReturnType<typeof publish>> = await publish("status").catch(() => ({ error: "github_error" }));
  if (r.error) {
    usePublish.setState({ error: ERRORS[r.error] ?? ERRORS.github_error, loaded: true });
    return;
  }
  const run = r.run ?? null;
  usePublish.setState({ run, error: null, loaded: true });
  if (run && run.status !== "completed") timer = setTimeout(poll, 10_000);
}

async function start() {
  usePublish.setState({ busy: true });
  const r: Awaited<ReturnType<typeof publish>> = await publish("publish").catch(() => ({ error: "github_error" }));
  usePublish.setState({ busy: false });
  if (r.error) {
    const message = ERRORS[r.error] ?? ERRORS.github_error;
    usePublish.setState({ error: message });
    toast(message, "warning");
    return;
  }
  toast("Publishing started. The shop updates in about 3 minutes.", "success");
  setTimeout(poll, 4000);
}

export function describeRun(run: DeployRun | null): { text: string; tone: "default" | "success" | "warning" } {
  if (!run) return { text: "Not published from admin yet.", tone: "default" };
  if (run.status !== "completed") return { text: `Publishing… started ${timeAgo(run.created_at)}.`, tone: "default" };
  if (run.conclusion === "success") return { text: `Live — last published ${timeAgo(run.created_at)}.`, tone: "success" };
  if (run.conclusion === "skipped") return { text: "Skipped: deploys are switched off (DEPLOY_ENABLED).", tone: "warning" };
  return { text: `Last publish failed (${timeAgo(run.created_at)}).`, tone: "warning" };
}

export function PublishButton({ compact }: { compact?: boolean }) {
  const { busy, run } = usePublish();
  const running = !!run && run.status !== "completed";
  return (
    <Button size={compact ? "sm" : "lg"} variant={compact ? "secondary" : "primary"} loading={busy || running} onClick={() => void start()} className={compact ? "" : "w-full sm:w-auto"}>
      {running ? "Publishing…" : compact ? "Publish" : "Publish changes"}
    </Button>
  );
}

export function PublishCard() {
  const { run, error, loaded } = usePublish();
  useEffect(() => {
    if (!usePublish.getState().loaded) void poll();
  }, []);
  const d = describeRun(run);
  return (
    <div className="grid gap-3">
      <p className="text-step-n1 text-ink-muted">
        Product, edit and photo changes show in the shop after you publish. Prices, stock and settings update instantly.
      </p>
      <PublishButton />
      <p role="status" className={d.tone === "success" ? "text-step-n1 text-success" : d.tone === "warning" || error ? "text-step-n1 text-warning" : "text-step-n1 text-ink-muted"}>
        {error ?? (loaded ? d.text : "Checking…")}
        {run?.html_url && !error && (
          <>
            {" "}
            <a href={run.html_url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
              Details
            </a>
          </>
        )}
      </p>
    </div>
  );
}
