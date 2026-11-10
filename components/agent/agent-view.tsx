"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, ViewTransition } from "react";
import { api } from "@/lib/client/api";
import { Icon } from "../icon";
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
  return (
    <ViewTransition key={runId ?? "new"} enter="page" exit="page" default="none">
      <div className="h-full">{runId ? <RunView runId={runId} /> : <NewTask />}</div>
    </ViewTransition>
  );
}

function RunView({ runId }: { runId: string }) {
  const router = useRouter();
  const { refreshRuns } = useWorkspace();
  const { run, frame, error, reload } = useRun(runId);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const [notice, setNotice] = useState<string>();
  const [computer, setComputer] = useState(false);
  const live = run ? LIVE.includes(run.status) : false;

  useEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [run?.events.length, run?.events]);

  if (error) return <p className="flex h-full items-center justify-center text-[14px] text-zinc-500">{error}</p>;
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
        <header className="flex h-14 shrink-0 items-center gap-1 px-6">
          <p className="min-w-0 flex-1 truncate text-[13.5px] text-zinc-700">{run.title}</p>
          <HeaderButton onClick={() => void repeat()} disabled={live} title="Start a new chat with the same task" icon="repeat" label="Repeat" />
        </header>
        <div
          ref={scroller}
          onScroll={(e) => {
            const el = e.currentTarget;
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
          }}
          className="scroll-thin flex-1 overflow-y-auto"
        >
          <div className="mx-auto w-full max-w-[740px] px-6 pt-4 pb-8">
            <Timeline run={run} live={live} onAnswer={(t) => void send(t)} />
          </div>
        </div>
        <div className="mx-auto w-full max-w-[740px] px-6 pb-5">
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
      {/* The agent's computer stays tucked behind this bar until it is asked for. */}
      <button
        onClick={() => setComputer((c) => !c)}
        aria-expanded={computer}
        aria-label={computer ? "Hide the agent's computer" : "Show the agent's computer"}
        title={computer ? "Hide computer" : live ? "Watch the agent's computer" : "Show computer"}
        className="group hidden w-5 shrink-0 cursor-pointer items-center justify-center lg:flex"
      >
        <span
          className={cx(
            "w-[5px] rounded-full transition-all duration-300 ease-out group-hover:w-[6px] group-active:scale-y-90",
            computer ? "h-10 group-hover:h-14" : "h-16 group-hover:h-24",
            live ? "pulse bg-emerald-500" : computer ? "bg-zinc-900/45 group-hover:bg-zinc-900/80" : "bg-zinc-900/25 group-hover:bg-zinc-900/70"
          )}
        />
      </button>
      <div className="computer hidden lg:block" data-open={computer} inert={!computer}>
        <div className="h-full w-[420px] xl:w-[480px]">
          <BrowserPanel run={run} frame={frame} live={live} />
        </div>
      </div>
    </div>
  );
}

function HeaderButton({ onClick, disabled, title, icon, label }: { onClick: () => void; disabled?: boolean; title: string; icon: "repeat"; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="press flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] text-zinc-600 hover:bg-zinc-900/[0.08] hover:text-zinc-900 disabled:opacity-40 disabled:hover:bg-transparent"
    >
      <Icon name={icon} size={14} />
      {label}
    </button>
  );
}
