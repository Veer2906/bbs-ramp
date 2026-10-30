"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  BookOpen,
  ChevronDown,
  FileCheck2,
  FileSearch,
  FileText,
  Globe,
  KeyRound,
  Link2,
  ListChecks,
  Loader2,
  MousePointerClick,
  Keyboard,
  Camera,
  CornerDownLeft,
  X,
} from "lucide-react";
import { api } from "@/lib/client/api";
import type { Run, RunEvent } from "@/lib/types";
import { useWorkspace } from "../workspace-provider";
import { Button, cx } from "../ui";
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

const ICONS: Record<string, typeof Globe> = {
  goto: Globe,
  click: MousePointerClick,
  type: Keyboard,
  fill_credential: KeyRound,
  request_credentials: KeyRound,
  select: ListChecks,
  check: ListChecks,
  press: CornerDownLeft,
  screenshot: Camera,
  download_url: ArrowDownToLine,
  save_page_as_pdf: ArrowDownToLine,
  read_document: FileSearch,
  list_files: FileText,
  record_document: FileText,
  get_ledger: BookOpen,
  match_document: Link2,
  flag_issue: AlertTriangle,
  update_plan: ListChecks,
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
        <p className="shimmer-text rise text-[13.5px] font-medium">Thinking</p>
      ) : null}
    </div>
  );
}

function Single({ event: e, run, live, onAnswer }: { event: RunEvent; run: Run; live: boolean; onAnswer: (t: string) => void }) {
  switch (e.kind) {
    case "user":
      return (
        <div className="rise flex justify-end">
          <div className="max-w-[85%] rounded-[20px] bg-zinc-900/[0.055] px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap text-zinc-900">{e.text}</div>
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
        <div className="rise rounded-2xl bg-rose-500/[0.07] px-4 py-3 text-[13.5px] leading-relaxed text-rose-800">
          <p className="font-medium">The run stopped</p>
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
          <ChevronDown className="size-3.5" />
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
        <Loader2 className={cx("size-3.5", running || row.text ? "animate-spin" : "")} />
        <span className={running ? "shimmer-text" : ""}>{row.text}</span>
      </div>
    );
  }
  if (row.kind === "document" || row.kind === "match" || row.kind === "issue") {
    const Icon = row.kind === "document" ? FileCheck2 : row.kind === "match" ? Link2 : AlertTriangle;
    const href = row.kind === "issue" ? "/issues" : row.kind === "document" ? `/documents?doc=${row.documentId}` : "/ledger";
    return (
      <Link
        href={href}
        className={cx(
          "my-0.5 flex min-h-9 items-center gap-2.5 rounded-xl px-3 py-1.5 text-[13px] transition-colors",
          row.kind === "issue"
            ? "bg-amber-500/[0.08] text-amber-900 hover:bg-amber-500/[0.13]"
            : row.kind === "match"
              ? "bg-emerald-500/[0.06] text-emerald-900 hover:bg-emerald-500/[0.11]"
              : "bg-zinc-900/[0.035] text-zinc-800 hover:bg-zinc-900/[0.06]"
        )}
      >
        <Icon className="size-3.5 shrink-0 opacity-70" />
        <span className="min-w-0 flex-1 truncate">{row.label}</span>
      </Link>
    );
  }
  const Icon = ICONS[row.tool] ?? Globe;
  return (
    <div className="group flex min-h-8 items-center gap-2.5 px-1 text-[13px]">
      {running ? (
        <Loader2 className="size-3.5 shrink-0 animate-spin text-zinc-500" />
      ) : row.ok === false ? (
        <X className="size-3.5 shrink-0 text-rose-500" />
      ) : (
        <Icon className="size-3.5 shrink-0 text-zinc-400" />
      )}
      <span className={cx("min-w-0 truncate", running ? "shimmer-text font-medium" : row.ok === false ? "text-rose-700" : "text-zinc-600")}>{row.label}</span>
      {row.ok === false && row.detail ? <span className="min-w-0 flex-1 truncate text-[12px] text-rose-500/80">{row.detail}</span> : <span className="flex-1" />}
      {row.ms !== undefined && row.ms >= 50 ? (
        <span className="tabular shrink-0 text-[11.5px] text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100">{(row.ms / 1000).toFixed(1)}s</span>
      ) : null}
    </div>
  );
}

function Question({ event, live, onAnswer }: { event: Extract<RunEvent, { kind: "question" }>; live: boolean; onAnswer: (t: string) => void }) {
  return (
    <div className="rise rounded-2xl bg-white p-4 shadow-[0_0_0_1px_rgba(217,119,6,0.25),0_8px_24px_-16px_rgba(217,119,6,0.5)]">
      <p className="text-[12px] font-medium text-amber-700">{live ? "Waiting for you" : "Question"}</p>
      <p className="mt-1 text-[14.5px] leading-relaxed whitespace-pre-wrap text-zinc-900">{event.text}</p>
      {event.answer ? (
        <p className="mt-3 text-[13px] text-zinc-500">You answered: {event.answer}</p>
      ) : live && event.options.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {event.options.map((o) => (
            <button
              key={o}
              onClick={() => onAnswer(o)}
              className="rounded-xl bg-zinc-900/[0.05] px-3 py-1.5 text-left text-[13px] font-medium text-zinc-800 transition-colors hover:bg-zinc-900 hover:text-white"
            >
              {o}
            </button>
          ))}
        </div>
      ) : live ? (
        <p className="mt-3 text-[12.5px] text-zinc-500">Reply below</p>
      ) : null}
    </div>
  );
}

function CredentialRequest({ event, runId, live }: { event: Extract<RunEvent, { kind: "credential" }>; runId: string; live: boolean }) {
  const [skipping, setSkipping] = useState(false);
  const [error, setError] = useState<string>();
  if (!live) {
    return (
      <div className="rise flex min-h-9 items-center gap-2.5 rounded-xl bg-zinc-900/[0.035] px-3 py-1.5 text-[13px] text-zinc-700">
        <KeyRound className="size-3.5 shrink-0 opacity-70" />
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
    <div className="rise rounded-2xl bg-white p-4 shadow-[0_0_0_1px_rgba(217,119,6,0.25),0_8px_24px_-16px_rgba(217,119,6,0.5)]">
      <div className="flex items-start gap-3 px-1">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/12">
          <KeyRound className="size-4 text-amber-800" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium text-amber-700">Login needed</p>
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
        <p className="flex-1 text-[12px] text-zinc-400">Encrypted before it is stored. The agent never sees the password.</p>
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
    <div className="rise rounded-2xl bg-white p-5 shadow-[0_0_0_1px_rgba(24,24,27,0.05),0_1px_2px_rgba(24,24,27,0.04)]">
      <div className="mb-4 grid grid-cols-3 gap-3">
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
    <Link href={href} className="rounded-xl bg-zinc-900/[0.035] px-3 py-2.5 transition-colors hover:bg-zinc-900/[0.06]">
      <p className={cx("tabular text-[20px] font-semibold tracking-tight", tone === "amber" ? "text-amber-700" : "text-zinc-900")}>{value}</p>
      <p className="text-[12px] text-zinc-500">{label}</p>
    </Link>
  );
}
