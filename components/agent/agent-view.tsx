"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { Px } from "../pixel-icon";
import { cx } from "../ui";
import { useWorkspace } from "../workspace-provider";
import { BrowserPanel } from "./browser-panel";
import { Composer } from "./composer";
import { ModelSwitch } from "./model-switch";
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
  const { run, frame, error, reload } = useRun(runId);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const [notice, setNotice] = useState<string>();
  const [computer, setComputer] = useState(true);
  const live = run ? LIVE.includes(run.status) : false;

  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [run?.events.length, run?.events]);

  if (error) return <p className="m-auto text-[14px] text-zinc-500">{error}</p>;
  if (!run) return null;

  const send = async (text: string) => {
    setNotice(undefined);
    stick.current = true;
    try {
      await api.message(run.id, text);
      if (!live) {
        reload();
        await refreshRuns();
      }
    } catch (e) {
      setNotice((e as Error).message);
      throw e;
    }
  };

  const repeat = async () => {
    setNotice(undefined);
    try {
      const next = await api.start(run.instruction);
      await refreshRuns();
      router.push(`/?run=${next.id}`);
    } catch (e) {
      setNotice((e as Error).message);
    }
  };

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-1 px-5">
          <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-zinc-600">{run.title}</p>
          <HeaderButton onClick={() => void repeat()} disabled={live} title="Start a new chat with the same task" icon="repeat" label="Repeat" />
          <HeaderButton onClick={() => setComputer((c) => !c)} active={computer} title={computer ? "Hide computer" : "Show computer"} icon="screen" label="Computer" />
        </header>
        <div
          ref={scroller}
          onScroll={(e) => {
            const el = e.currentTarget;
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
          }}
          className="scroll-thin flex-1 overflow-y-auto"
        >
          <div className="mx-auto w-full max-w-[720px] px-6 pt-4 pb-8">
            <Timeline run={run} live={live} onAnswer={(t) => void send(t)} />
          </div>
        </div>
        <div className="mx-auto w-full max-w-[720px] px-6 pb-5">
          {notice ? <p className="rise mb-2 px-2 text-[12.5px] text-rose-600">{notice}</p> : null}
          <Composer
            placeholder={run.status === "waiting" ? "Answer the question" : live ? "Add guidance while it works" : "Reply"}
            onSubmit={send}
            busy={live}
            onStop={() => void api.stop(run.id).then(refreshRuns)}
            tools={<ModelSwitch />}
          />
        </div>
      </div>
      <div className="computer hidden lg:block" data-open={computer}>
        <div className="h-full w-[420px] xl:w-[480px]">
          <BrowserPanel run={run} frame={frame} live={live} onClose={() => setComputer(false)} />
        </div>
      </div>
    </div>
  );
}

function HeaderButton({ onClick, disabled, active, title, icon, label }: { onClick: () => void; disabled?: boolean; active?: boolean; title: string; icon: "repeat" | "screen"; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cx(
        "press flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] text-zinc-500 hover:bg-zinc-900/[0.05] hover:text-zinc-900 disabled:opacity-40 disabled:hover:bg-transparent",
        active && "bg-zinc-900/[0.05] text-zinc-900"
      )}
    >
      <Px name={icon} scale={1} />
      {label}
    </button>
  );
}
