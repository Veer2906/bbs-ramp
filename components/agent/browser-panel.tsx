"use client";

import { Check, Globe, Loader2, Monitor } from "lucide-react";
import { useEffect, useState } from "react";
import { duration } from "@/lib/client/api";
import type { Run } from "@/lib/types";
import { cx } from "../ui";
import type { Frame } from "./use-run";

export function BrowserPanel({ run, frame, live }: { run: Run; frame?: Frame; live: boolean }) {
  const [now, setNow] = useState(run.updatedAt);
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [live]);
  const end = live ? Math.max(now, run.updatedAt) : run.updatedAt;
  const u = run.usage;
  const cachedPct = u.input + u.cacheRead + u.cacheWrite > 0 ? Math.round((100 * u.cacheRead) / (u.input + u.cacheRead + u.cacheWrite)) : 0;

  return (
    <div className="scroll-thin flex h-full flex-col gap-4 overflow-y-auto p-4 pl-0">
      <div className="overflow-hidden rounded-2xl bg-white shadow-[0_0_0_1px_rgba(24,24,27,0.05),0_1px_2px_rgba(24,24,27,0.04)]">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <Globe className="size-3.5 shrink-0 text-zinc-400" />
          <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-zinc-500">{frame?.url || run.browser?.url || "about:blank"}</span>
          {live ? <span className="text-[11.5px] font-medium text-emerald-700">Live</span> : null}
        </div>
        <div className="relative aspect-[1280/860] bg-zinc-100">
          {frame ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`data:image/jpeg;base64,${frame.image}`} alt={frame.title || "Browser"} className="absolute inset-0 size-full object-cover object-top" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-400">
              <Monitor className="size-5" />
              <span className="text-[12px]">{live ? "Waiting for the browser" : "No browser activity"}</span>
            </div>
          )}
        </div>
      </div>

      {run.plan.length ? (
        <div className="rounded-2xl bg-white p-4 shadow-[0_0_0_1px_rgba(24,24,27,0.05),0_1px_2px_rgba(24,24,27,0.04)]">
          <p className="mb-3 text-[12px] font-medium text-zinc-500">Plan</p>
          <ol className="flex flex-col gap-2.5">
            {run.plan.map((s, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span
                  className={cx(
                    "mt-px flex size-[18px] shrink-0 items-center justify-center rounded-md text-[10.5px] font-semibold tabular",
                    s.status === "done" && "bg-zinc-900 text-white",
                    s.status === "active" && "bg-zinc-900/10 text-zinc-900",
                    s.status === "pending" && "bg-zinc-900/[0.05] text-zinc-400",
                    s.status === "skipped" && "bg-zinc-900/[0.05] text-zinc-300"
                  )}
                >
                  {s.status === "done" ? <Check className="size-3" strokeWidth={3} /> : s.status === "active" && live ? <Loader2 className="size-3 animate-spin" /> : i + 1}
                </span>
                <span
                  className={cx(
                    "text-[13px] leading-snug",
                    s.status === "done" && "text-zinc-500",
                    s.status === "active" && "font-medium text-zinc-900",
                    s.status === "pending" && "text-zinc-600",
                    s.status === "skipped" && "text-zinc-400 line-through"
                  )}
                >
                  {s.title}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl bg-white p-4 shadow-[0_0_0_1px_rgba(24,24,27,0.05),0_1px_2px_rgba(24,24,27,0.04)]">
        <Stat label="Elapsed" value={duration(end - run.createdAt)} />
        <Stat label="Model cost" value={`$${u.costUsd.toFixed(u.costUsd < 1 ? 3 : 2)}`} />
        <Stat label="Model" value={run.model.replace(/^(global|us|eu|apac)\.anthropic\./, "").replace(/^anthropic\./, "")} />
        <Stat label="Cache hits" value={`${cachedPct}%`} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11.5px] text-zinc-400">{label}</p>
      <p className="tabular truncate text-[13px] font-medium text-zinc-800">{value}</p>
    </div>
  );
}
