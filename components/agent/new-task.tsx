"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type WorkspaceState } from "@/lib/client/api";
import { Scramble, Spinner, cx } from "../ui";
import { PixelStairs, Px } from "../pixel-icon";
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

  const boxLabel =
    box?.state === "ready"
      ? "ready"
      : box?.state === "error"
        ? (box.message ?? "unavailable")
        : box?.state === "provisioning"
          ? (box.message ?? "starting").toLowerCase()
          : "connecting";
  const model = s ? (s.provider === "bedrock" ? s.bedrockModel : s.anthropicModel) : undefined;

  return (
    <div className="scroll-thin relative flex h-full flex-col overflow-y-auto">
      <PixelStairs heights={[1, 1, 2, 3, 4, 6]} block={22} className="pointer-events-none absolute right-0 bottom-0" />
      <div className="m-auto w-full max-w-[700px] px-6 py-16">
        <Tape />
        <p className="eyebrow mt-10">
          <span className="text-zinc-300">[00] </span>
          <Scramble text="New task" />
        </p>
        <h1 className="mt-3 flex flex-wrap items-center gap-x-3 text-[46px] leading-[1.02] font-semibold tracking-[-0.045em] text-zinc-900">
          What should I <Px name="download" scale={4} className="text-moss" /> retrieve?
        </h1>
        <p className="mt-3 max-w-[520px] text-[14px] leading-relaxed text-zinc-500">
          Describe the documents in plain words. The agent signs in to each vendor portal, downloads what it finds, and reconciles it against your ledger.
        </p>
        <div className="mt-7">
          <Composer large autoFocus value={value} onValueChange={setValue} placeholder="Retrieve every October invoice and reconcile it" onSubmit={start} />
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

        <div className="mt-6 flex flex-col">
          {SUGGESTIONS.map((q, i) => (
            <button
              key={q}
              onClick={() => setValue(q)}
              className="press group flex items-center gap-4 rounded-lg px-3 py-2.5 text-left text-[13.5px] text-zinc-600 hover:bg-zinc-900/[0.045] hover:text-zinc-900"
            >
              <span className="font-mono text-[10.5px] text-zinc-300 group-hover:text-zinc-500">{String(i + 1).padStart(2, "0")}</span>
              <span className="flex-1">{q}</span>
              <Px name="next" scale={1.5} className="text-zinc-500 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100" />
            </button>
          ))}
        </div>

        <div className="mt-10 grid grid-cols-3 gap-3 font-mono text-[10.5px] tracking-wide uppercase">
          <Readout label="Portals" value={String(s?.portals.length ?? 0).padStart(2, "0")} title={s?.portals.map((p) => p.name).join(", ")} />
          <Readout
            label="Sailbox"
            value={boxLabel}
            tone={box?.state === "error" ? "bad" : box?.state === "ready" ? "ok" : undefined}
            busy={!box || box.state === "provisioning" || box.state === "idle"}
          />
          <Readout label="Model" value={model ?? "..."} />
        </div>
      </div>
    </div>
  );
}

const TAPE = ["INV-2315", "PO-4471", "RCPT-0091", "FRT-88213", "INV-2307", "CM-0042", "PO-4502", "INV-2291", "RCPT-0103", "BOL-7710"];

/** Ticker tape of document ids drifting past, set in mono. */
function Tape() {
  const row = TAPE.map((t, i) => (
    <span key={i} className="flex items-center gap-6">
      <span>{t}</span>
      <span className="text-zinc-300">{i % 3 === 2 ? "» ledger" : "»"}</span>
    </span>
  ));
  return (
    <div aria-hidden className="tape-mask overflow-hidden font-mono text-[11px] tracking-wider text-zinc-400 uppercase">
      <div className="tape flex w-max gap-6">
        {row}
        {row}
      </div>
    </div>
  );
}

function Readout({ label, value, tone, busy, title }: { label: string; value: string; tone?: "ok" | "bad"; busy?: boolean; title?: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-zinc-900/[0.04] px-3 py-2.5" title={title}>
      <p className="text-zinc-400">{label}</p>
      <p className={cx("mt-1 flex items-center gap-1.5 truncate normal-case", tone === "ok" ? "text-emerald-700" : tone === "bad" ? "text-rose-600" : "text-zinc-700")}>
        {busy ? <Spinner /> : null}
        <span className="truncate">{value}</span>
      </p>
    </div>
  );
}
