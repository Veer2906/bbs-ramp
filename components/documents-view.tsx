"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { api, docTypeLabel, money, shortDate } from "@/lib/client/api";
import type { FinancialDocument } from "@/lib/types";
import { DocStatus } from "./doc-status";
import { Px } from "./pixel-icon";
import { Button, Empty, PageHeader, Panel, Segmented, cx, inputClass } from "./ui";
import { useWorkspace } from "./workspace-provider";

type TypeFilter = "all" | FinancialDocument["type"];
type StatusFilter = "all" | "needs_review" | "matched" | "extracted" | "approved";

export function DocumentsView() {
  const { data, refreshData } = useWorkspace();
  const params = useSearchParams();
  const router = useRouter();
  const selectedId = params.get("doc");
  const [type, setType] = useState<TypeFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [q, setQ] = useState("");

  const docs = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...data.documents]
      .filter((d) => type === "all" || d.type === type)
      .filter((d) => status === "all" || d.status === status)
      .filter((d) => !needle || [d.vendor, d.number, d.poNumber, d.reference].some((v) => v?.toLowerCase().includes(needle)))
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || b.createdAt - a.createdAt);
  }, [data.documents, type, status, q]);

  const selected = data.documents.find((d) => d.id === selectedId);
  const total = docs.reduce((s, d) => s + (d.type === "credit_memo" ? -(d.amount ?? 0) : d.type === "invoice" ? (d.amount ?? 0) : 0), 0);
  const types = Array.from(new Set(data.documents.map((d) => d.type)));
  const select = (id?: string) => router.replace(id ? `/documents?doc=${id}` : "/documents", { scroll: false });

  return (
    <div className="flex h-full min-h-0">
      <div className="scroll-thin min-w-0 flex-1 overflow-y-auto pb-10">
        <PageHeader
          index="01"
          title="Documents"
          subtitle={data.documents.length ? `${data.documents.length} retrieved · ${money(total)} invoiced in view` : "Everything the agent retrieves lands here"}
        />
        <div className="flex flex-wrap items-center gap-3 px-8 pb-4">
          <div className="relative w-64">
            <Px name="search" className="pointer-events-none absolute top-1/2 left-3 size-3 -translate-y-1/2 text-zinc-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Vendor, number or PO" className={cx(inputClass, "pl-8")} />
          </div>
          <Segmented<StatusFilter>
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "All" },
              { value: "needs_review", label: "Needs review" },
              { value: "matched", label: "Matched" },
              { value: "extracted", label: "Unmatched" },
              { value: "approved", label: "Approved" },
            ]}
          />
          {types.length > 1 ? (
            <Segmented<TypeFilter>
              value={type}
              onChange={setType}
              options={[{ value: "all", label: "All types" }, ...types.map((t) => ({ value: t, label: docTypeLabel[t] }))]}
            />
          ) : null}
        </div>
        <div className="px-8">
          <Panel className="overflow-hidden p-1.5">
            {docs.length === 0 ? (
              <Empty
                title={data.documents.length ? "No documents match" : "No documents yet"}
                hint={data.documents.length ? "Try a different filter." : "Start a task and retrieved invoices, purchase orders and receipts appear here."}
              />
            ) : (
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="eyebrow">
                    <th className="px-3 py-2 font-medium">Document</th>
                    <th className="px-3 py-2 font-medium">Vendor</th>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">PO</th>
                    <th className="px-3 py-2 text-right font-medium">Amount</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((d) => (
                    <tr
                      key={d.id}
                      onClick={() => select(d.id)}
                      className={cx("cursor-pointer transition-colors [&>td:first-child]:rounded-l-xl [&>td:last-child]:rounded-r-xl", d.id === selectedId ? "bg-zinc-900/[0.05]" : "hover:bg-zinc-900/[0.03]")}
                    >
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-zinc-900">{d.number}</p>
                        <p className="text-[12px] text-zinc-500">{docTypeLabel[d.type]}</p>
                      </td>
                      <td className="px-3 py-2.5 text-zinc-700">{d.vendor}</td>
                      <td className="tabular px-3 py-2.5 whitespace-nowrap text-zinc-600">{shortDate(d.date)}</td>
                      <td className="px-3 py-2.5 font-mono text-[12px] whitespace-nowrap text-zinc-500">{d.poNumber ?? "—"}</td>
                      <td className="tabular px-3 py-2.5 text-right font-medium text-zinc-900">{money(d.amount, d.currency)}</td>
                      <td className="px-3 py-2.5">
                        <DocStatus status={d.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>
      </div>
      {selected ? <DocumentDrawer doc={selected} onClose={() => select()} onChange={refreshData} /> : null}
    </div>
  );
}

function DocumentDrawer({ doc, onClose, onChange }: { doc: FinancialDocument; onClose: () => void; onChange: () => Promise<void> }) {
  const { data } = useWorkspace();
  const [busy, setBusy] = useState<string>();
  const entry = data.ledger.find((e) => e.id === doc.ledgerId);
  const issues = data.issues.filter((i) => i.documentIds.includes(doc.id) && i.status === "open");
  const isPdf = doc.fileName?.toLowerCase().endsWith(".pdf");
  const isImage = /\.(png|jpe?g|gif|webp)$/i.test(doc.fileName ?? "");

  const set = async (status: FinancialDocument["status"]) => {
    setBusy(status);
    try {
      await api.updateDocument(doc.id, { status });
      await onChange();
    } finally {
      setBusy(undefined);
    }
  };

  const fields: [string, React.ReactNode][] = [
    ["Type", docTypeLabel[doc.type]],
    ["Vendor", doc.vendor],
    ["Date", shortDate(doc.date)],
    ["Due", shortDate(doc.dueDate)],
    ["PO", doc.poNumber ?? "—"],
    ["Reference", doc.reference ?? "—"],
  ];

  return (
    <aside className="rise flex w-[520px] shrink-0 flex-col bg-[#fffefb] shadow-[-1px_0_0_rgba(28,27,24,0.07),-24px_0_48px_-32px_rgba(28,27,24,0.3)]">
      <div className="flex items-start gap-3 px-6 pt-6 pb-4">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-zinc-500">{doc.vendor}</p>
          <h2 className="truncate text-[19px] font-semibold tracking-tight text-zinc-900">{doc.number}</h2>
          <p className="tabular mt-1 text-[24px] font-semibold tracking-tight text-zinc-900">{money(doc.amount, doc.currency)}</p>
        </div>
        <DocStatus status={doc.status} />
        <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-900/5 hover:text-zinc-800" title="Close">
          <Px name="x" className="size-3" />
        </button>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto px-6 pb-6">
        <div className="grid grid-cols-3 gap-x-4 gap-y-3">
          {fields.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <p className="eyebrow">{k}</p>
              <p className="truncate text-[13px] text-zinc-800">{v}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-lg bg-zinc-900/[0.035] p-3.5">
          <p className="eyebrow">Ledger match</p>
          {entry ? (
            <div className="mt-1 flex items-baseline justify-between gap-3">
              <p className="text-[13px] text-zinc-800">
                {entry.description} <span className="text-zinc-400">{entry.id}</span>
              </p>
              <p className="tabular text-[13px] font-medium text-zinc-900">{money(entry.amount)}</p>
            </div>
          ) : (
            <p className="mt-1 text-[13px] text-zinc-500">Not matched to a ledger transaction</p>
          )}
          {doc.matchConfidence ? <p className="mt-1 text-[12px] text-zinc-500">Confidence: {doc.matchConfidence}</p> : null}
        </div>

        {issues.length ? (
          <div className="mt-3 flex flex-col gap-2">
            {issues.map((i) => (
              <div key={i.id} className="rounded-lg bg-amber-500/[0.08] p-3.5">
                <p className="text-[13px] font-medium text-amber-900">{i.title}</p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-amber-800/80">{i.detail}</p>
              </div>
            ))}
          </div>
        ) : null}

        {doc.lineItems.length ? (
          <div className="mt-5">
            <p className="eyebrow mb-1.5">Line items</p>
            <table className="w-full text-[12.5px]">
              <tbody>
                {doc.lineItems.map((li, i) => (
                  <tr key={i} className="align-top">
                    <td className="py-1 pr-3 text-zinc-700">{li.description}</td>
                    <td className="tabular py-1 pr-3 text-right text-zinc-400">{li.quantity !== undefined ? `${li.quantity} ×` : ""}</td>
                    <td className="tabular py-1 text-right text-zinc-800">{money(li.amount ?? (li.quantity ?? 0) * (li.unit_price ?? 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {doc.notes ? <p className="mt-4 text-[12.5px] leading-relaxed text-zinc-500">{doc.notes}</p> : null}

        {doc.fileName ? (
          <div className="mt-5 overflow-hidden rounded-lg bg-zinc-100">
            {isPdf ? (
              <iframe src={`/api/files/${doc.id}#toolbar=0&navpanes=0&view=FitH`} className="h-[520px] w-full" title={doc.number} />
            ) : isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/files/${doc.id}`} alt={doc.number} className="w-full" />
            ) : (
              <iframe src={`/api/files/${doc.id}`} sandbox="" className="h-[420px] w-full bg-white" title={doc.number} />
            )}
          </div>
        ) : null}
        {doc.sourceUrl ? <p className="mt-2 truncate font-mono text-[11px] text-zinc-400">Source: {doc.sourceUrl}</p> : null}
      </div>

      <div className="flex items-center gap-2 px-6 pt-3 pb-5">
        <Button variant="primary" loading={busy === "approved"} onClick={() => void set("approved")} disabled={doc.status === "approved"}>
          Approve
        </Button>
        <Button variant="ghost" loading={busy === "rejected"} onClick={() => void set("rejected")} disabled={doc.status === "rejected"}>
          Reject
        </Button>
        <span className="flex-1" />
        {doc.fileName ? (
          <a href={`/api/files/${doc.id}?download`} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13.5px] font-medium text-zinc-600 hover:bg-zinc-900/5 hover:text-zinc-900">
            <Px name="download" className="size-3" />
            Download
          </a>
        ) : null}
      </div>
    </aside>
  );
}
