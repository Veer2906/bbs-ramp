"use client";

import { useEffect, useState } from "react";
import { duration } from "@/lib/client/api";
import type { Run } from "@/lib/types";
import { Px } from "../pixel-icon";
import { AsciiBar, Odometer, Spinner, cx } from "../ui";
import type { Frame } from "./use-run";

function Corners() {
  const c = "pointer-events-none absolute size-3 border-zinc-900/40";
  return (
    <>
      <span className={cx(c, "top-2 left-2 border-t border-l")} />
      <span className={cx(c, "top-2 right-2 border-t border-r")} />
      <span className={cx(c, "bottom-2 left-2 border-b border-l")} />
      <span className={cx(c, "right-2 bottom-2 border-r border-b")} />
    </>
  );
}

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
  const done = run.plan.filter((s) => s.status === "done" || s.status === "skipped").length;
  const progress = run.plan.length ? done / run.plan.length : 0;

  return (
    <div className="scroll-thin flex h-full flex-col gap-3 overflow-y-auto p-4 pl-0">
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <span className="font-mono text-[11px] text-zinc-400">{">"}</span>
          <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-zinc-600">{frame?.url || run.browser?.url || "about:blank"}</span>
          {live ? (
            <span className="flex items-center gap-1.5 bg-lime px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-wider text-zinc-900 uppercase">
              <span className="caret">▮</span>
              Live
            </span>
          ) : (
            <span className="font-mono text-[10px] tracking-wider text-zinc-400 uppercase">Idle</span>
          )}
        </div>
        <div className={cx("relative aspect-[1280/860] overflow-hidden", frame ? "bg-zinc-100" : "px-checker")}>
          {frame ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`data:image/jpeg;base64,${frame.image}`} alt={frame.title || "Browser"} className="absolute inset-0 size-full object-cover object-top" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 font-mono text-[11px] tracking-wide text-zinc-400 uppercase">
              {live ? <Spinner className="text-[16px] text-zinc-500" /> : <Px name="globe" scale={4} className="mb-1 text-moss" />}
              <span>{live ? "Waiting for the browser" : "No browser activity"}</span>
            </div>
          )}
          {live ? <div className="scanline pointer-events-none absolute inset-0" /> : null}
          <Corners />
        </div>
      </div>

      {run.plan.length ? (
        <div className="card p-4">
          <div className="mb-3 flex items-center gap-3">
            <p className="eyebrow flex-1">Plan</p>
            <AsciiBar value={progress} width={14} className="text-[10px]" />
            <span className="tabular font-mono text-[10.5px] text-zinc-500">{`${done}/${run.plan.length}`}</span>
          </div>
          <ol className="flex flex-col gap-2">
            {run.plan.map((s, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  className={cx(
                    "mt-px w-7 shrink-0 font-mono text-[11px] leading-[18px]",
                    s.status === "done" && "text-zinc-900",
                    s.status === "active" && "text-zinc-900",
                    s.status === "pending" && "text-zinc-300",
                    s.status === "skipped" && "text-zinc-300"
                  )}
                >
                  {s.status === "done" ? "[x]" : s.status === "active" ? live ? <span className="inline-flex">[<Spinner />]</span> : "[>]" : s.status === "skipped" ? "[-]" : "[ ]"}
                </span>
                <span
                  className={cx(
                    "text-[13px] leading-[18px]",
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

      <div className="card grid grid-cols-2 gap-x-4 gap-y-4 p-4">
        <Stat label="Elapsed" value={duration(end - run.createdAt)} />
        <Stat label="Model cost" value={`$${u.costUsd.toFixed(u.costUsd < 1 ? 3 : 2)}`} />
        <Stat label="Model" value={run.model.replace(/^(global|us|eu|apac)\.anthropic\./, "").replace(/^anthropic\./, "")} mono />
        <Stat label="Cache hits" value={`${cachedPct}%`} />
      </div>
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="eyebrow">{label}</p>
      {mono ? (
        <p className="mt-1.5 truncate font-mono text-[12px] text-zinc-800">{value}</p>
      ) : (
        <Odometer value={value} className="mt-1.5 text-[17px] font-medium tracking-tight text-zinc-900" />
      )}
    </div>
  );
}
