"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { api, type WorkspaceState } from "@/lib/client/api";
import { useWorkspace } from "../workspace-provider";
import { Composer } from "./composer";

const SUGGESTIONS = [
  "Retrieve every October 2026 invoice from all vendor portals and reconcile them against the ledger",
  "Download Contoso's freight bills and purchase orders for Q3 2026 and flag anything that doesn't match",
  "Find Acme's payment receipts and credit memos and tell me which invoices are still open",
  "Check which ledger transactions are missing supporting documents",
];

export function NewTask() {
  const router = useRouter();
  const { settings, refreshRuns } = useWorkspace();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string>();
  const [box, setBox] = useState<WorkspaceState>();

  useEffect(() => {
    let alive = true;
    // Warm the cloud computer while the user is typing so the first action is instant.
    api
      .warmWorkspace()
      .then((s) => alive && setBox(s))
      .catch(() => undefined);
    const t = setInterval(() => {
      api
        .workspace()
        .then((s) => {
          if (!alive) return;
          setBox(s);
          if (s.state === "ready" || s.state === "error") clearInterval(t);
        })
        .catch(() => undefined);
    }, 2000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const s = settings?.settings;
  const providerReady = s ? s.available[s.provider] : true;

  const start = async (text: string) => {
    setError(undefined);
    try {
      const run = await api.start(text);
      await refreshRuns();
      router.push(`/?run=${run.id}`);
    } catch (e) {
      setError((e as Error).message);
      throw e;
    }
  };

  return (
    <div className="scroll-thin flex h-full flex-col overflow-y-auto">
      <div className="m-auto w-full max-w-[680px] px-6 py-16">
        <h1 className="text-[28px] font-semibold tracking-tight text-zinc-900">What should I retrieve?</h1>
        <p className="mt-2 text-[14.5px] leading-relaxed text-zinc-500">
          I sign in to your vendor portals, find the transactions, download invoices, purchase orders and receipts, and reconcile them against the ledger.
        </p>

        <div className="mt-8">
          <Composer large autoFocus value={value} onValueChange={setValue} placeholder="Describe the documents you need" onSubmit={start} />
          {error ? <p className="mt-2 px-2 text-[12.5px] text-rose-600">{error}</p> : null}
          {s && !providerReady ? (
            <p className="mt-3 px-2 text-[12.5px] text-amber-700">
              No {s.provider === "bedrock" ? "AWS Bedrock credentials" : "Anthropic API key"} found.{" "}
              <Link href="/settings" className="underline underline-offset-2">
                Open settings
              </Link>
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex flex-col gap-1">
          {SUGGESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => setValue(q)}
              className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13.5px] text-zinc-600 transition-colors hover:bg-zinc-900/[0.04] hover:text-zinc-900"
            >
              <span className="flex-1">{q}</span>
              <ArrowUpRight className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
            </button>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 px-3 text-[12.5px] text-zinc-400">
          <span>
            {s?.portals.length ?? 0} {s?.portals.length === 1 ? "portal" : "portals"} connected
            {s?.portals.length ? <span className="text-zinc-500">{`: ${s.portals.map((p) => p.name).join(", ")}`}</span> : null}
          </span>
          <span>
            Cloud computer{" "}
            <span className={box?.state === "error" ? "text-rose-600" : box?.state === "ready" ? "text-emerald-700" : "text-zinc-500"}>
              {box?.state === "ready"
                ? "ready"
                : box?.state === "error"
                  ? (box.message ?? "unavailable")
                  : box?.state === "provisioning"
                    ? (box.message ?? "starting").toLowerCase()
                    : "connecting"}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
