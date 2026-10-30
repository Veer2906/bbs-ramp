"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ago } from "@/lib/client/api";
import type { Issue } from "@/lib/types";
import { Button, Empty, PageHeader, Panel, Pill, Segmented, type Tone } from "./ui";
import { useWorkspace } from "./workspace-provider";

const KIND: Record<Issue["kind"], string> = {
  missing_document: "Missing document",
  amount_mismatch: "Amount mismatch",
  duplicate: "Possible duplicate",
  ambiguous: "Ambiguous match",
  unrecorded: "Not in ledger",
  access: "Portal access",
  other: "Other",
};

const SEVERITY: Record<Issue["severity"], Tone> = { high: "red", medium: "amber", low: "neutral" };

export function IssuesView() {
  const { data, refreshData, refreshRuns, runs } = useWorkspace();
  const router = useRouter();
  const [filter, setFilter] = useState<Issue["status"]>("open");
  const [busy, setBusy] = useState<string>();
  const busyRun = runs.some((r) => ["starting", "running", "waiting"].includes(r.status));

  const rank = { high: 0, medium: 1, low: 2 };
  const issues = data.issues.filter((i) => i.status === filter).sort((a, b) => rank[a.severity] - rank[b.severity] || b.createdAt - a.createdAt);

  const toggle = async (i: Issue) => {
    setBusy(i.id);
    try {
      await api.updateIssue(i.id, i.status === "open" ? "resolved" : "open");
      await refreshData();
    } finally {
      setBusy(undefined);
    }
  };

  const investigate = async (i: Issue) => {
    setBusy(`run-${i.id}`);
    try {
      const docs = data.documents.filter((d) => i.documentIds.includes(d.id)).map((d) => `${d.number} (${d.id})`);
      const run = await api.start(
        `Investigate this reconciliation issue and resolve it if the portal has the answer: "${i.title}". ${i.detail}${i.ledgerId ? ` Ledger transaction: ${i.ledgerId}.` : ""}${docs.length ? ` Documents: ${docs.join(", ")}.` : ""} Look for credit memos, revised invoices, receipts or a missing document.`
      );
      await refreshRuns();
      router.push(`/?run=${run.id}`);
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <div className="scroll-thin h-full overflow-y-auto pb-10">
      <PageHeader
        index="03"
        title="Issues"
        subtitle="Missing documents, mismatches and anything else the agent wants a person to check"
        actions={
          <Segmented<Issue["status"]>
            value={filter}
            onChange={setFilter}
            options={[
              { value: "open", label: `Open ${data.issues.filter((i) => i.status === "open").length}` },
              { value: "resolved", label: "Resolved" },
            ]}
          />
        }
      />
      <div className="flex max-w-[880px] flex-col gap-3 px-8">
        {issues.length === 0 ? (
          <Panel>
            <Empty title={filter === "open" ? "Nothing needs attention" : "No resolved issues yet"} hint={filter === "open" ? "Issues the agent finds during a task show up here." : undefined} />
          </Panel>
        ) : null}
        {issues.map((i) => {
          const docs = data.documents.filter((d) => i.documentIds.includes(d.id));
          const entry = data.ledger.find((e) => e.id === i.ledgerId);
          return (
            <Panel key={i.id} className="p-5">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={SEVERITY[i.severity]}>{KIND[i.kind]}</Pill>
                    <span className="text-[12px] text-zinc-400">{ago(i.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-[14.5px] font-medium text-zinc-900">{i.title}</p>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-zinc-600">{i.detail}</p>
                  {docs.length || entry ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {entry ? (
                        <Link href="/ledger" className="rounded-lg bg-zinc-900/[0.04] px-2.5 py-1 text-[12.5px] text-zinc-700 hover:bg-zinc-900/[0.07]">
                          {entry.id} · {entry.description}
                        </Link>
                      ) : null}
                      {docs.map((d) => (
                        <Link key={d.id} href={`/documents?doc=${d.id}`} className="rounded-lg bg-zinc-900/[0.04] px-2.5 py-1 text-[12.5px] text-zinc-700 hover:bg-zinc-900/[0.07]">
                          {d.number}
                        </Link>
                      ))}
                      <Link href={`/?run=${i.runId}`} className="rounded-lg px-2.5 py-1 text-[12.5px] text-zinc-400 hover:text-zinc-700">
                        View task
                      </Link>
                    </div>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <Button size="sm" variant={i.status === "open" ? "primary" : "secondary"} loading={busy === i.id} onClick={() => void toggle(i)}>
                    {i.status === "open" ? "Resolve" : "Reopen"}
                  </Button>
                  {i.status === "open" && i.kind !== "access" ? (
                    <Button size="sm" variant="ghost" loading={busy === `run-${i.id}`} disabled={busyRun} onClick={() => void investigate(i)} title={busyRun ? "A task is already running" : undefined}>
                      Investigate
                    </Button>
                  ) : null}
                </div>
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
