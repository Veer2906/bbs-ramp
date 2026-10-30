"use client";

import type { Run } from "@/lib/types";
import { Px } from "../pixel-icon";
import { Spinner, cx } from "../ui";
import type { Frame } from "./use-run";

/** The agent's computer: the live browser screen on the Sailbox. */
export function BrowserPanel({ run, frame, live, onClose }: { run: Run; frame?: Frame; live: boolean; onClose: () => void }) {
  const url = frame?.url || run.browser?.url || "about:blank";
  return (
    <div className="flex h-full flex-col p-4 pl-0">
      <div className="card flex min-h-0 flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2">
          <span className={cx("size-1.5 shrink-0 rounded-full transition-colors", live ? "pulse bg-leaf" : "bg-zinc-300")} />
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-zinc-500">{url}</span>
          <button onClick={onClose} title="Hide computer" className="press flex size-6 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-900/[0.05] hover:text-zinc-900">
            <Px name="close" scale={1} />
          </button>
        </div>
        <div className="relative aspect-[1280/860] overflow-hidden bg-zinc-100">
          {frame ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={frame.url} src={`data:image/jpeg;base64,${frame.image}`} alt={frame.title || "Browser"} className="frame-in absolute inset-0 size-full object-cover object-top" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[12px] text-zinc-400">
              {live ? <Spinner className="text-[14px] text-zinc-500" /> : <Px name="globe" scale={2} className="text-zinc-300" />}
              <span>{live ? "Starting the browser" : "No browser activity"}</span>
            </div>
          )}
          {live ? <div className="scanline pointer-events-none absolute inset-0" /> : null}
        </div>
        {frame?.title ? <p className="truncate px-3 py-2 text-[12px] text-zinc-500">{frame.title}</p> : null}
      </div>
    </div>
  );
}
