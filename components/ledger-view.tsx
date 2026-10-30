"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Px } from "./pixel-icon";
import { api, docTypeLabel, money, shortDate } from "@/lib/client/api";
import type { FinancialDocument, LedgerEntry } from "@/lib/types";
import { AsciiBar, Button, Odometer, PageHeader, Panel, Pill, type Tone, cx } from "./ui";
import { useWorkspace } from "./workspace-provider";

type State = "matched" | "review" | "missing";

const STATE: Record<State, [string, Tone]> = {
  matched: ["Matched", "green"],
  review: ["Review", "amber"],
  missing: ["No document", "neutral"],
};

export function LedgerView() {
  const { data, refreshData } = useWorkspace();
  const file = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();
  const [open, setOpen] = useState<string>();

  const rows = data.ledger.map((e) => {
    const docs = data.documents.filter((d) => d.ledgerId === e.id && d.status !== "rejected");
    const issues = data.issues.filter((i) => i.ledgerId === e.id && i.status === "open");
    const state: State = !docs.length
      ? "missing"
      : issues.length || docs.some((d) => d.status === "needs_review" || d.status === "extracted")
        ? "review"
        : "matched";
    return { entry: e, docs, issues, state };
  });
  const unlinked = data.documents.filter((d) => !d.ledgerId && d.status !== "rejected" && d.type !== "purchase_order");
  const count = (s: State) => rows.filter((r) => r.state === s).length;
  const coverage = rows.length ? Math.round((100 * (rows.length - count("missing"))) / rows.length) : 0;

  const importCsv = async (f: File) => {
    setError(undefined);
    try {
      await api.importLedger(await f.text());
      await refreshData();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="scroll-thin h-full overflow-y-auto pb-10">
      <PageHeader
        title="Reconciliation"
        subtitle="Ledger transactions and the documents that support them"
        actions={
          <>
            <input ref={file} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && void importCsv(e.target.files[0])} />
            <Button onClick={() => file.current?.click()}>
              <Px name="upload" />
              Import ledger CSV
            </Button>
          </>
        }
      />
      {error ? <p className="-mt-3 px-8 pb-3 text-[12.5px] text-rose-600">{error}</p> : null}

      <div className="grid grid-cols-2 gap-3 px-8 pb-5 md:grid-cols-4">
        <Metric label="Document coverage" value={`${coverage}%`} bar={coverage / 100} />
        <Metric label="Matched" value={count("matched")} />
        <Metric label="Needs review" value={count("review")} tone={count("review") ? "amber" : undefined} />
        <Metric label="Without documents" value={count("missing")} />
      </div>

      <div className="px-8">
        <Panel className="p-1.5">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="eyebrow">
                <th className="px-3 py-2 font-medium">Transaction</th>
                <th className="px-3 py-2 font-medium">Vendor</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">PO</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Documents</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ entry, docs, issues, state }) => (
                <Row key={entry.id} entry={entry} docs={docs} issues={issues.length} state={state} open={open === entry.id} toggle={() => setOpen(open === entry.id ? undefined : entry.id)} />
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      {unlinked.length ? (
        <div className="px-8 pt-8">
          <p className="mb-1 text-[20px] font-semibold tracking-[-0.03em] text-zinc-900">Documents without a ledger transaction</p>
          <p className="mb-3 text-[13px] text-zinc-500">Possible unrecorded liabilities or payments to reconcile.</p>
          <Panel className="p-1.5">
            {unlinked.map((d) => (
              <Link key={d.id} href={`/documents?doc=${d.id}`} className="flex items-center gap-4 rounded-lg px-3 py-2.5 text-[13px] transition-colors hover:bg-zinc-900/[0.03]">
                <span className="w-40 font-medium text-zinc-900">{d.number}</span>
                <span className="w-28 text-zinc-500">{docTypeLabel[d.type]}</span>
                <span className="flex-1 text-zinc-700">{d.vendor}</span>
                <span className="tabular text-zinc-600">{shortDate(d.date)}</span>
                <span className="tabular w-28 text-right font-medium text-zinc-900">{money(d.amount, d.currency)}</span>
              </Link>
            ))}
          </Panel>
        </div>
      ) : null}
    </div>
  );
}

function Row({
  entry,
  docs,
  issues,
  state,
  open,
  toggle,
}: {
  entry: LedgerEntry;
  docs: FinancialDocument[];
  issues: number;
  state: State;
  open: boolean;
  toggle: () => void;
}) {
  const [label, tone] = STATE[state];
  return (
    <>
      <tr onClick={toggle} className={cx("cursor-pointer transition-colors ", open ? "bg-zinc-900/[0.04]" : "hover:bg-zinc-900/[0.03]")}>
        <td className="px-3 py-2.5">
          <p className="font-medium text-zinc-900">{entry.description}</p>
          <p className="text-[12px] text-zinc-400">{entry.id}{entry.reference ? ` · ${entry.reference}` : ""}</p>
        </td>
        <td className="px-3 py-2.5 text-zinc-700">{entry.vendor}</td>
        <td className="tabular px-3 py-2.5 text-zinc-600">{shortDate(entry.date)}</td>
        <td className="px-3 py-2.5 font-mono text-[12px] text-zinc-500">{entry.poNumber ?? "—"}</td>
        <td className="tabular px-3 py-2.5 text-right font-medium text-zinc-900">{money(entry.amount)}</td>
        <td className="px-3 py-2.5 text-zinc-600">{docs.length ? docs.map((d) => d.number).join(", ") : "—"}</td>
        <td className="px-3 py-2.5">
          <Pill tone={tone}>{issues ? `${label} · ${issues}` : label}</Pill>
        </td>
      </tr>
      {open && docs.length ? (
        <tr>
          <td colSpan={7} className="px-3 pt-1 pb-3">
            <div className="flex flex-wrap gap-2">
              {docs.map((d) => {
                const diff = d.type === "invoice" && d.amount !== undefined ? d.amount - entry.amount : 0;
                return (
                  <Link key={d.id} href={`/documents?doc=${d.id}`} className="rounded-lg bg-zinc-900/[0.04] px-3 py-2 text-[12.5px] transition-colors hover:bg-zinc-900/[0.07]">
                    <span className="font-medium text-zinc-900">{docTypeLabel[d.type]} {d.number}</span>
                    <span className="tabular ml-2 text-zinc-600">{money(d.amount, d.currency)}</span>
                    {Math.abs(diff) > 0.01 ? <span className="tabular ml-2 text-amber-700">{diff > 0 ? "+" : ""}{money(diff)}</span> : null}
                  </Link>
                );
              })}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function Metric({ label, value, tone, bar }: { label: string; value: string | number; tone?: "amber"; bar?: number }) {
  return (
    <Panel className="px-4 py-4">
      <p className="eyebrow">{label}</p>
      <Odometer value={typeof value === "number" ? String(value).padStart(2, "0") : value} className={cx("mt-3 text-[28px] font-semibold tracking-[-0.04em]", tone === "amber" ? "text-amber-700" : "text-zinc-900")} />
      {bar !== undefined ? <AsciiBar value={bar} width={22} className="mt-3 flex" /> : null}
    </Panel>
  );
}
