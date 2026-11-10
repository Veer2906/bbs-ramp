"use client";

import type { Run } from "@/lib/types";
import { Icon } from "../icon";
import { Spinner } from "../ui";
import type { Frame } from "./use-run";

/** The agent's computer: the live browser screen on the Sailbox, shown as a sheet on the right edge. */
export function BrowserPanel({ run, frame, live }: { run: Run; frame?: Frame; live: boolean }) {
  const url = frame?.url || run.browser?.url;
  return (
    <div className="h-full py-3 pr-3">
      <div className="card flex h-full flex-col overflow-hidden !rounded-[18px]">
        <div className="flex h-11 shrink-0 items-center gap-2.5 px-4">
          <span className="text-[13px] font-medium text-zinc-800">Computer</span>
          {live ? <span className="pulse text-[12px] font-medium text-emerald-600">Live</span> : null}
          <span className="min-w-0 flex-1 truncate text-right text-[12px] text-zinc-500">{url ? url.replace(/^https?:\/\//, "") : ""}</span>
        </div>
        <div className="relative mx-2 aspect-[1280/860] shrink-0 overflow-hidden rounded-[12px] bg-black/45">
          {frame ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={frame.url} src={`data:image/jpeg;base64,${frame.image}`} alt={frame.title || "Browser"} className="frame-in absolute inset-0 size-full object-cover object-top" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[12.5px] text-zinc-500">
              {live ? <Spinner className="text-[14px] text-zinc-500" /> : <Icon name="screen" size={20} className="text-zinc-400" />}
              <span>{live ? "Starting the browser" : "The browser is idle"}</span>
            </div>
          )}
          {live ? <div className="scanline pointer-events-none absolute inset-0" /> : null}
        </div>
        <p className="truncate px-4 pt-3 text-[13px] text-zinc-800">{frame?.title || (live ? "Opening the first page" : "Nothing on screen")}</p>
        <p className="px-4 pt-1 text-[12.5px] leading-relaxed text-zinc-500">A real browser on a cloud computer. You see each page as the agent does, and the server types sign-ins from the vault.</p>
      </div>
    </div>
  );
}
