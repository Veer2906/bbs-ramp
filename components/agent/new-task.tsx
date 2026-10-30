"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client/api";
import { Px } from "../pixel-icon";
import { useWorkspace } from "../workspace-provider";
import { Composer } from "./composer";
import { ModelSwitch } from "./model-switch";

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

  useEffect(() => {
    // Warm the cloud computer while the user is typing so the first action is instant.
    api.warmWorkspace().catch(() => undefined);
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
      <div className="m-auto w-full max-w-[640px] px-6 py-16">
        <h1 className="rise text-[32px] leading-tight font-semibold tracking-[-0.035em] text-zinc-900">What should I retrieve?</h1>
        <p className="rise mt-2 text-[14px] text-zinc-500" style={{ animationDelay: "60ms" }}>
          Describe the documents. The agent signs in to your vendor portals, downloads them and reconciles them against your ledger.
        </p>
        <div className="rise mt-7" style={{ animationDelay: "120ms" }}>
          <Composer large autoFocus value={value} onValueChange={setValue} placeholder="Retrieve every October invoice and reconcile it" onSubmit={start} tools={<ModelSwitch />} />
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
        <div className="rise mt-5 flex flex-col" style={{ animationDelay: "180ms" }}>
          {SUGGESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => setValue(q)}
              className="group flex items-center gap-3 px-2 py-2 text-left text-[13.5px] text-zinc-500 transition-colors hover:text-zinc-900"
            >
              <span className="flex-1">{q}</span>
              <Px name="next" scale={1} className="text-zinc-400 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
