"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { useWorkspace } from "../workspace-provider";
import { BrowserPanel } from "./browser-panel";
import { Composer } from "./composer";
import { NewTask } from "./new-task";
import { Timeline } from "./timeline";
import { useRun } from "./use-run";

const LIVE = ["starting", "running", "waiting"];

export function AgentView() {
  const params = useSearchParams();
  const runId = params.get("run");
  return runId ? <RunView key={runId} runId={runId} /> : <NewTask />;
}

function RunView({ runId }: { runId: string }) {
  const router = useRouter();
  const { refreshRuns } = useWorkspace();
  const { run, frame, error } = useRun(runId);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const [notice, setNotice] = useState<string>();
  const live = run ? LIVE.includes(run.status) : false;

  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [run?.events.length, run?.events]);

  if (error) return <p className="m-auto text-[14px] text-zinc-500">{error}</p>;
  if (!run) return null;

  const send = async (text: string) => {
    setNotice(undefined);
    try {
      if (live) {
        await api.message(run.id, text);
      } else {
        const summary = [...run.events].reverse().find((e) => e.kind === "summary");
        const context = `Follow-up to an earlier task ("${run.instruction}")${summary && summary.kind === "summary" ? `, which ended with: ${summary.text}` : ""}\n\n${text}`;
        const next = await api.start(context);
        await refreshRuns();
        router.push(`/?run=${next.id}`);
      }
    } catch (e) {
      setNotice((e as Error).message);
      throw e;
    }
  };

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <div
          ref={scroller}
          onScroll={(e) => {
            const el = e.currentTarget;
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
          }}
          className="scroll-thin flex-1 overflow-y-auto"
        >
          <div className="mx-auto w-full max-w-[720px] px-6 pt-10 pb-8">
            <Timeline run={run} live={live} onAnswer={(t) => void send(t)} />
          </div>
        </div>
        <div className="mx-auto w-full max-w-[720px] px-6 pb-5">
          {notice ? <p className="mb-2 px-2 text-[12.5px] text-rose-600">{notice}</p> : null}
          <Composer
            placeholder={run.status === "waiting" ? "Answer the question" : live ? "Add guidance while it works" : "Ask a follow-up"}
            onSubmit={send}
            busy={live}
            onStop={() => void api.stop(run.id).then(refreshRuns)}
          />
        </div>
      </div>
      <div className="hidden w-[400px] shrink-0 lg:block xl:w-[460px]">
        <BrowserPanel run={run} frame={frame} live={live} />
      </div>
    </div>
  );
}
