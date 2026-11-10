"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon, type IconName } from "../icon";
import { api, brief, duration } from "@/lib/client/api";
import { Markdown } from "../markdown";
import type { Run, RunEvent } from "@/lib/types";
import { Button, Spinner, cx } from "../ui";
import { EntryForm } from "../vault-view";

type Row = Extract<RunEvent, { kind: "action" | "document" | "match" | "issue" | "status" }>;
type Item = { kind: "group"; rows: Row[]; key: number } | { kind: "single"; event: RunEvent; key: number };

const GROUPED = new Set(["action", "document", "match", "issue", "status"]);
// These tools produce their own document/match/issue card, so the plain action row is noise once it succeeds.
const CARDED = new Set(["record_document", "match_document", "flag_issue", "update_plan"]);

function group(events: RunEvent[]): Item[] {
  const out: Item[] = [];
  for (const e of events) {
    if (GROUPED.has(e.kind)) {
      const last = out[out.length - 1];
      if (e.kind === "action" && CARDED.has(e.tool) && e.ok !== false) continue;
      if (last?.kind === "group") last.rows.push(e as Row);
      else out.push({ kind: "group", rows: [e as Row], key: e.id });
    } else out.push({ kind: "single", event: e, key: e.id });
  }
  return out;
}

const ICONS: Record<string, IconName> = {
  goto: "globe",
  click: "cursor",
  type: "keyboard",
  fill_credential: "key",
  request_credentials: "key",
  select: "list",
  check: "check",
  press: "enter",
  screenshot: "camera",
  download_url: "download",
  save_page_as_pdf: "download",
  read_document: "search",
  list_files: "doc",
  record_document: "doc",
  get_ledger: "ledger",
  match_document: "link",
  flag_issue: "alert",
  update_plan: "list",
};

type Turn = { key: number; user?: RunEvent; trace: RunEvent[]; tail: RunEvent[] };

/** Split the run into turns: each user message, the agent's working trace, then its summary or error. */
function turns(events: RunEvent[]): Turn[] {
  const out: Turn[] = [];
  for (const e of events) {
    if (e.kind === "user" || !out.length) out.push({ key: e.id, user: e.kind === "user" ? e : undefined, trace: [], tail: [] });
    if (e.kind === "user") continue;
    if (e.kind === "action" && e.tool === "remember") continue;
    const t = out[out.length - 1];
    if (e.kind === "summary" || e.kind === "error") t.tail.push(e);
    else t.trace.push(e);
  }
  return out;
}

export function Timeline({ run, live, onAnswer }: { run: Run; live: boolean; onAnswer: (text: string) => void }) {
  const list = turns(run.events);
  return (
    <div className="flex flex-col gap-6">
      {list.map((t, i) => (
        <TurnView key={t.key} turn={t} run={run} active={live && i === list.length - 1} onAnswer={onAnswer} />
      ))}
    </div>
  );
}

function TurnView({ turn, run, active, onAnswer }: { turn: Turn; run: Run; active: boolean; onAnswer: (t: string) => void }) {
  const [manual, setManual] = useState<boolean>();
  const waiting = active && run.status === "waiting";
  const finished = !active && turn.tail.length > 0;
  const open = waiting || (manual ?? !finished);
  const items = group(turn.trace);
  const steps = turn.trace.filter((e) => e.kind === "action").length;
  const first = turn.user?.t ?? turn.trace[0]?.t ?? 0;
  const last = (turn.tail[0] ?? turn.trace[turn.trace.length - 1])?.t ?? first;
  const thinking = active && !waiting && items[items.length - 1]?.kind !== "group";

  return (
    <div className="flex flex-col gap-3">
      {turn.user ? <Single event={turn.user} run={run} live={active} onAnswer={onAnswer} /> : null}
      {items.length || active ? (
        <div>
          <button
            onClick={() => setManual(!open)}
            disabled={waiting}
            className="group flex h-7 items-center gap-2 text-[12.5px] text-zinc-500 hover:text-zinc-900 disabled:hover:text-zinc-500"
          >
            {active ? <Spinner className="text-[12px] text-zinc-700" /> : <Icon name="chevron" size={13} className={cx("transition-transform duration-300", open ? "" : "-rotate-90")} />}
            <span className={active && !waiting ? "shimmer-text" : ""}>
              {waiting ? "Waiting for you" : active ? "Thinking" : `Worked for ${duration(Math.max(0, last - first))}`}
            </span>
            {steps ? <span className="tabular text-[12px] text-zinc-400">{`${steps} ${steps === 1 ? "step" : "steps"}`}</span> : null}
          </button>
          <div className="fold" data-closed={!open}>
            <div>
              <div className="relative mt-1 ml-[3px] pl-5">
                <span aria-hidden className="tree-rail absolute top-0 bottom-2 left-0 w-px bg-zinc-900/[0.14]" />
                <div className="flex flex-col gap-3">
                  {items.map((it, idx) => (
                    <div key={it.key} className="tree-node relative before:absolute before:top-[15px] before:-left-5 before:h-px before:w-3 before:bg-zinc-900/[0.14]">
                      {it.kind === "group" ? (
                        <ActionGroup rows={it.rows} active={active && idx === items.length - 1} />
                      ) : (
                        <Single event={it.event} run={run} live={active} onAnswer={onAnswer} />
                      )}
                    </div>
                  ))}
                  {thinking ? (
                    <div className="tree-node relative flex h-8 items-center gap-2 text-[13px] text-zinc-400 before:absolute before:top-[15px] before:-left-5 before:h-px before:w-3 before:bg-zinc-900/[0.14]">
                      <span className="caret">▍</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {turn.tail.map((e) => (
        <Single key={e.id} event={e} run={run} live={active} onAnswer={onAnswer} />
      ))}
    </div>
  );
}

function Single({ event: e, run, live, onAnswer }: { event: RunEvent; run: Run; live: boolean; onAnswer: (t: string) => void }) {
  switch (e.kind) {
    case "user":
      return (
        <div className="rise flex justify-end">
          <div className="bubble max-w-[85%] rounded-[18px] rounded-br-md bg-zinc-900/[0.11] px-4 py-2.5 text-[14.5px] leading-relaxed whitespace-pre-wrap text-zinc-900 shadow-[inset_0_0_0_1px_rgb(244_241_234/0.06)]">{e.text}</div>
        </div>
      );
    case "note":
      return <Markdown text={e.text} className="rise pt-[5px] text-[14px] leading-relaxed text-zinc-800" />;
    case "credential":
      return <CredentialRequest event={e} runId={run.id} live={live && run.status === "waiting" && !e.outcome} />;
    case "question":
      return <Question event={e} live={live && run.status === "waiting" && !e.answer} onAnswer={onAnswer} />;
    case "error":
      return (
        <div className="rise rounded-[14px] bg-rose-500/[0.1] px-4 py-3 text-[13.5px] leading-relaxed">
          <p className="font-medium text-rose-700">The agent stopped</p>
          <p className="mt-0.5 line-clamp-4 text-rose-800/80">{brief(e.text) ?? e.text}</p>
        </div>
      );
    case "summary":
      return <Summary text={e.text} />;
    default:
      return null;
  }
}

function ActionGroup({ rows, active }: { rows: Row[]; active: boolean }) {
  const [open, setOpen] = useState(false);
  const LIMIT = 5;
  const hidden = !open && rows.length > LIMIT + 1 ? rows.length - LIMIT : 0;
  const shown = hidden ? rows.slice(-LIMIT) : rows;
  const steps = rows.filter((r) => r.kind === "action").length;
  return (
    <div className="rise flex flex-col">
      {hidden ? (
        <button onClick={() => setOpen(true)} className="mb-1 flex h-7 items-center gap-1.5 self-start rounded-lg px-1 text-[12.5px] text-zinc-500 hover:text-zinc-800">
          <Icon name="chevron" size={13} />
          {hidden} earlier {hidden === 1 ? "step" : "steps"}
        </button>
      ) : null}
      <div className="flex flex-col gap-0.5">
        {shown.map((r, i) => (
          <ActionRow key={r.id} row={r} running={active && i === shown.length - 1 && r.kind === "action" && r.ok === undefined} />
        ))}
      </div>
      {open && steps > LIMIT ? (
        <button onClick={() => setOpen(false)} className="mt-1 self-start px-1 text-[12.5px] text-zinc-400 hover:text-zinc-700">
          Show less
        </button>
      ) : null}
    </div>
  );
}

function ActionRow({ row, running }: { row: Row; running: boolean }) {
  if (row.kind === "status") {
    return (
      <div className="flex h-8 items-center gap-2.5 px-1 text-[13px] text-zinc-500">
        <Spinner className="mx-0.5 text-[12px] text-zinc-500" />
        <span className={running ? "shimmer-text" : ""}>{row.text}</span>
      </div>
    );
  }
  if (row.kind === "document" || row.kind === "match" || row.kind === "issue") {
    const icon: IconName = row.kind === "document" ? "docCheck" : row.kind === "match" ? "link" : "alert";
    const href = row.kind === "issue" ? "/issues" : row.kind === "document" ? `/documents?doc=${row.documentId}` : "/ledger";
    return (
      <Link
        href={href}
        className={cx(
          "row -mx-1 flex min-h-8 items-center gap-2.5 rounded-lg px-1 py-1 text-[13px]",
          row.kind === "issue" ? "text-amber-700" : "text-zinc-800"
        )}
      >
        <Icon name={icon} className={row.kind === "issue" ? "shrink-0 text-amber-500" : "shrink-0 text-zinc-500"} />
        <span className="min-w-0 flex-1 truncate">{row.label}</span>
        <span className="pr-1 text-[12px] text-zinc-400">{row.kind === "document" ? "Document" : row.kind === "match" ? "Match" : "Issue"}</span>
      </Link>
    );
  }
  const icon = ICONS[row.tool] ?? "globe";
  return (
    <div className="group flex min-h-8 items-center gap-2.5 px-1 text-[13px]">
      {running ? (
        <Spinner className="mx-0.5 text-[12px] text-zinc-500" />
      ) : row.ok === false ? (
        <Icon name="x" className="shrink-0 text-rose-500" />
      ) : (
        <Icon name={icon} className="shrink-0 text-zinc-400" />
      )}
      <span className={cx("min-w-0 truncate", running ? "shimmer-text font-medium" : row.ok === false ? "text-rose-700" : "text-zinc-700")}>{row.label}</span>
      {row.ok === false && row.detail ? <span className="min-w-0 flex-1 truncate text-[12px] text-rose-600/80">{row.detail}</span> : <span className="flex-1" />}
      {row.ms !== undefined && row.ms >= 50 ? (
        <span className="tabular shrink-0 text-[11.5px] text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100">{(row.ms / 1000).toFixed(1)}s</span>
      ) : null}
    </div>
  );
}

function Question({ event, live, onAnswer }: { event: Extract<RunEvent, { kind: "question" }>; live: boolean; onAnswer: (t: string) => void }) {
  return (
    <div className="rise card p-4">
      <p className="flex items-center gap-2 text-[12.5px] font-medium text-amber-700">{live ? "Waiting on you" : <span className="text-zinc-500">Question</span>}</p>
      <Markdown text={event.text} className="mt-1 text-[14.5px] leading-relaxed text-zinc-900" />
      {event.answer ? (
        <p className="mt-3 text-[13px] text-zinc-500">You answered: {event.answer}</p>
      ) : live && event.options.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {event.options.map((o) => (
            <button
              key={o}
              onClick={() => onAnswer(o)}
              className="press rounded-[10px] bg-zinc-900/[0.09] px-3 py-1.5 text-left text-[13px] font-medium text-zinc-900 hover:bg-plaster hover:text-ink"
            >
              {o}
            </button>
          ))}
        </div>
      ) : live ? (
        <p className="mt-3 text-[12.5px] text-zinc-500">Reply in the box below</p>
      ) : null}
    </div>
  );
}

function CredentialRequest({ event, runId, live }: { event: Extract<RunEvent, { kind: "credential" }>; runId: string; live: boolean }) {
  const [skipping, setSkipping] = useState(false);
  const [error, setError] = useState<string>();
  if (!live) {
    return (
      <div className="rise flex min-h-8 items-center gap-2.5 py-1 text-[13px] text-zinc-600">
        <Icon name="key" className="shrink-0 text-zinc-400" />
        <span className="min-w-0 flex-1 truncate">
          {event.outcome === "saved"
            ? `Login for ${event.site} saved to the vault`
            : event.outcome === "skipped"
              ? `Skipped the login for ${event.site}`
              : `Login for ${event.site} was not added`}
        </span>
        {event.outcome === "saved" ? (
          <Link href="/vault" className="text-[12.5px] text-zinc-500 hover:text-zinc-900">
            Vault
          </Link>
        ) : null}
      </div>
    );
  }
  return (
    <div className="rise card p-4">
      <p className="flex items-center gap-2 text-[12.5px] font-medium text-amber-700">Login needed</p>
      <p className="mt-1 text-[14.5px] leading-relaxed text-zinc-900">{`Add the login for ${event.site} to the vault`}</p>
      {event.reason ? <p className="mt-0.5 text-[13px] text-zinc-500">{event.reason}</p> : null}
      <div className="mt-3">
        <EntryForm
          bare
          initial={{ name: event.site, url: event.url }}
          usernameLabel={event.usernameHint || "Username"}
          submitLabel="Save to vault and continue"
          onSave={async (d) => {
            await api.answerCredential(runId, { rid: event.rid, action: "save", ...d });
          }}
        />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <p className="flex-1 text-[12.5px] text-zinc-500">The agent can type this password but cannot read it.</p>
        {error ? <span className="text-[12px] text-rose-600">{error}</span> : null}
        <Button
          size="sm"
          variant="ghost"
          loading={skipping}
          onClick={async () => {
            setSkipping(true);
            try {
              await api.answerCredential(runId, { rid: event.rid, action: "skip" });
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setSkipping(false);
            }
          }}
        >
          Skip this portal
        </Button>
      </div>
    </div>
  );
}

function Summary({ text }: { text: string }) {
  return <Markdown text={text} className="answer text-[14.5px] leading-[1.7] text-zinc-800" />;
}
