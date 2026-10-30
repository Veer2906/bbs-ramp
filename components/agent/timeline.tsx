"use client";

import Link from "next/link";
import { useState } from "react";
import { Px, type PixelName } from "../pixel-icon";
import { api } from "@/lib/client/api";
import type { Run, RunEvent } from "@/lib/types";
import { useWorkspace } from "../workspace-provider";
import { Button, Odometer, Spinner, cx } from "../ui";
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

const ICONS: Record<string, PixelName> = {
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

export function Timeline({ run, live, onAnswer }: { run: Run; live: boolean; onAnswer: (text: string) => void }) {
  const items = group(run.events);
  return (
    <div className="flex flex-col gap-5">
      {items.map((it, idx) =>
        it.kind === "group" ? (
          <ActionGroup key={it.key} rows={it.rows} active={live && idx === items.length - 1} />
        ) : (
          <Single key={it.key} event={it.event} run={run} live={live} onAnswer={onAnswer} />
        )
      )}
      {live && items[items.length - 1]?.kind !== "group" && run.status !== "waiting" ? (
        <p className="rise flex items-center gap-2 font-mono text-[11.5px] tracking-wide text-zinc-500 uppercase">
          <Spinner className="text-zinc-700" />
          <span className="shimmer-text">Thinking</span>
          <span className="caret text-zinc-700">▍</span>
        </p>
      ) : null}
    </div>
  );
}

function Single({ event: e, run, live, onAnswer }: { event: RunEvent; run: Run; live: boolean; onAnswer: (t: string) => void }) {
  switch (e.kind) {
    case "user":
      return (
        <div className="rise flex justify-end">
          <div className="max-w-[85%] rounded-none bg-moss px-4 py-2.5 text-[14px] text-[#eef2ea] leading-relaxed whitespace-pre-wrap">{e.text}</div>
        </div>
      );
    case "note":
      return <p className="rise text-[14.5px] leading-relaxed whitespace-pre-wrap text-zinc-800">{e.text}</p>;
    case "credential":
      return <CredentialRequest event={e} runId={run.id} live={live && run.status === "waiting" && !e.outcome} />;
    case "question":
      return <Question event={e} live={live && run.status === "waiting" && !e.answer} onAnswer={onAnswer} />;
    case "error":
      return (
        <div className="rise rounded-none bg-rose-500/[0.08] px-4 py-3 text-[13.5px] leading-relaxed text-rose-800">
          <p className="eyebrow !text-rose-700">Run stopped</p>
          <p className="mt-0.5 text-rose-700">{e.text}</p>
        </div>
      );
    case "summary":
      return <Summary text={e.text} run={run} />;
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
          <Px name="chevron" scale={1} />
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
        <Spinner className="w-3.5 text-[12px] text-zinc-500" />
        <span className={running ? "shimmer-text" : ""}>{row.text}</span>
      </div>
    );
  }
  if (row.kind === "document" || row.kind === "match" || row.kind === "issue") {
    const icon: PixelName = row.kind === "document" ? "docCheck" : row.kind === "match" ? "link" : "alert";
    const href = row.kind === "issue" ? "/issues" : row.kind === "document" ? `/documents?doc=${row.documentId}` : "/ledger";
    return (
      <Link
        href={href}
        className={cx(
          "press my-0.5 flex min-h-9 items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px]",
          row.kind === "issue"
            ? "bg-amber-500/[0.08] text-amber-900 hover:bg-amber-500/[0.13]"
            : row.kind === "match"
              ? "bg-emerald-500/[0.06] text-emerald-900 hover:bg-emerald-500/[0.11]"
              : "bg-zinc-900/[0.035] text-zinc-800 hover:bg-zinc-900/[0.06]"
        )}
      >
        <Px name={icon} className="shrink-0 text-moss" />
        <span className="min-w-0 flex-1 truncate">{row.label}</span>
        <span className="font-mono text-[10px] tracking-wider uppercase opacity-50">{row.kind === "document" ? "doc" : row.kind}</span>
      </Link>
    );
  }
  const icon = ICONS[row.tool] ?? "globe";
  return (
    <div className="group flex min-h-8 items-center gap-2.5 px-1 text-[13px]">
      {running ? (
        <Spinner className="w-3.5 text-[12px] text-zinc-700" />
      ) : row.ok === false ? (
        <Px name="x" className="shrink-0 text-rose-500" />
      ) : (
        <Px name={icon} className="shrink-0 text-moss" />
      )}
      <span className={cx("min-w-0 truncate", running ? "shimmer-text font-medium" : row.ok === false ? "text-rose-700" : "text-zinc-600")}>{row.label}</span>
      {row.ok === false && row.detail ? <span className="min-w-0 flex-1 truncate text-[12px] text-rose-500/80">{row.detail}</span> : <span className="flex-1" />}
      {row.ms !== undefined && row.ms >= 50 ? (
        <span className="tabular shrink-0 font-mono text-[10.5px] text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100">{(row.ms / 1000).toFixed(1)}s</span>
      ) : null}
    </div>
  );
}

function Question({ event, live, onAnswer }: { event: Extract<RunEvent, { kind: "question" }>; live: boolean; onAnswer: (t: string) => void }) {
  return (
    <div className="rise card relative overflow-hidden p-4 pl-5 before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-lime-deep">
      <p className="eyebrow flex items-center gap-1.5 !text-zinc-600">{live ? <><Spinner /> Waiting for you</> : "Question"}</p>
      <p className="mt-1 text-[14.5px] leading-relaxed whitespace-pre-wrap text-zinc-900">{event.text}</p>
      {event.answer ? (
        <p className="mt-3 text-[13px] text-zinc-500">You answered: {event.answer}</p>
      ) : live && event.options.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {event.options.map((o) => (
            <button
              key={o}
              onClick={() => onAnswer(o)}
              className="press rounded-lg bg-zinc-900/[0.055] px-3 py-1.5 text-left text-[13px] font-medium text-zinc-800 hover:bg-moss hover:text-lime"
            >
              {o}
            </button>
          ))}
        </div>
      ) : live ? (
        <p className="mt-3 font-mono text-[10.5px] tracking-wide text-zinc-400 uppercase">Reply below ↓</p>
      ) : null}
    </div>
  );
}

function CredentialRequest({ event, runId, live }: { event: Extract<RunEvent, { kind: "credential" }>; runId: string; live: boolean }) {
  const [skipping, setSkipping] = useState(false);
  const [error, setError] = useState<string>();
  if (!live) {
    return (
      <div className="rise flex min-h-9 items-center gap-2.5 rounded-lg bg-zinc-900/[0.04] px-3 py-1.5 text-[13px] text-zinc-700">
        <Px name="key" className="shrink-0 opacity-70" />
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
    <div className="rise card relative overflow-hidden p-4 pl-5 before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-lime-deep">
      <div className="flex items-start gap-3 px-1">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-lime">
          <Px name="key" className="text-moss" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="eyebrow flex items-center gap-1.5 !text-zinc-600"><Spinner /> Login needed</p>
          <p className="mt-0.5 text-[14.5px] leading-relaxed text-zinc-900">{`Add the login for ${event.site} to the vault`}</p>
          {event.reason ? <p className="mt-0.5 text-[13px] text-zinc-500">{event.reason}</p> : null}
        </div>
      </div>
      <div className="mt-3 [&>div]:p-0 [&>div]:shadow-none">
        <EntryForm
          initial={{ name: event.site, url: event.url }}
          usernameLabel={event.usernameHint || "Username"}
          submitLabel="Save to vault and continue"
          onSave={async (d) => {
            await api.answerCredential(runId, { rid: event.rid, action: "save", ...d });
          }}
        />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <p className="flex-1 font-mono text-[10.5px] tracking-wide text-zinc-400">AES-256-GCM. The agent never sees the password.</p>
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

function Summary({ text, run }: { text: string; run: Run }) {
  const { data } = useWorkspace();
  const docs = data.documents.filter((d) => d.runId === run.id);
  const matched = docs.filter((d) => d.ledgerId).length;
  const issues = data.issues.filter((i) => i.runId === run.id);
  const open = issues.filter((i) => i.status === "open").length;
  return (
    <div className="rise card p-5">
      <p className="eyebrow mb-3">Summary</p>
      <div className="mb-4 grid grid-cols-3 gap-2">
        <Metric href="/documents" label="Documents" value={docs.length} />
        <Metric href="/ledger" label="Matched" value={matched} />
        <Metric href="/issues" label="Open issues" value={open} tone={open ? "amber" : undefined} />
      </div>
      <p className="text-[14px] leading-relaxed whitespace-pre-wrap text-zinc-800">{text}</p>
    </div>
  );
}

function Metric({ href, label, value, tone }: { href: string; label: string; value: number; tone?: "amber" }) {
  return (
    <Link href={href} className="press group rounded-lg bg-zinc-900/[0.04] px-3 py-3 hover:bg-zinc-900/[0.07]">
      <Odometer value={String(value).padStart(2, "0")} className={cx("font-pixel text-[28px]", tone === "amber" ? "text-amber-700" : "text-zinc-900")} />
      <p className="eyebrow mt-2 flex items-center justify-between">
        {label}
        <Px name="next" scale={1.5} className="transition-transform group-hover:translate-x-0.5" />
      </p>
    </Link>
  );
}
