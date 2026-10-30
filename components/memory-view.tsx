"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ago, type MemoryDraft } from "@/lib/client/api";
import type { MemoryKind, MemoryNode } from "@/lib/types";
import { KINDS, MemoryGraph } from "./memory-graph";
import { Px } from "./pixel-icon";
import { Button, Empty, PageHeader, Panel, Segmented, cx, inputClass } from "./ui";

export function MemoryView() {
  const [nodes, setNodes] = useState<MemoryNode[]>();
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState<string>();
  const [filter, setFilter] = useState<MemoryKind | "all">("all");

  const load = useCallback(async () => {
    try {
      setNodes(await api.memory());
      setError(undefined);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const shown = (nodes ?? []).filter((n) => filter === "all" || n.kind === filter);

  return (
    <div className="scroll-thin h-full overflow-y-auto pb-16">
      <PageHeader
        title="Memory"
        subtitle="Facts the agent reads before every task: key dates, important invoices, vendor quirks and your rules. Edit anything here and the next task uses it. The agent also keeps it up to date in the background."
        actions={
          <Button variant="primary" onClick={() => setEditing("new")} disabled={editing === "new"}>
            <Px name="plus" scale={1} />
            Add fact
          </Button>
        }
      />
      <div className="flex max-w-[860px] flex-col gap-4 px-8">
        {error ? <p className="text-[13px] text-rose-600">{error}</p> : null}
        {nodes?.length ? <MemoryGraph nodes={nodes} selected={editing} onSelect={setEditing} /> : null}
        {editing === "new" ? (
          <MemoryForm
            nodes={nodes ?? []}
            initial={{ kind: filter === "all" ? "note" : filter }}
            onCancel={() => setEditing(undefined)}
            onSave={async (d) => {
              await api.addMemory(d);
              setEditing(undefined);
              await load();
            }}
          />
        ) : null}
        {nodes?.length ? (
          <div className="mt-2">
            <Segmented value={filter} onChange={setFilter} options={[{ value: "all", label: "All" }, ...KINDS]} />
          </div>
        ) : null}
        {nodes?.length === 0 && editing !== "new" ? <Empty title="Nothing remembered yet" hint="Add key dates, invoices or vendor notes, or let the agent save what it learns." /> : null}
        <div className="flex flex-col gap-2">
          {shown.map((n) =>
            editing === n.id ? (
              <MemoryForm
                key={n.id}
                node={n}
                nodes={nodes ?? []}
                onCancel={() => setEditing(undefined)}
                onSave={async (d) => {
                  await api.updateMemory(n.id, d);
                  setEditing(undefined);
                  await load();
                }}
                onDelete={async () => {
                  await api.deleteMemory(n.id);
                  setEditing(undefined);
                  await load();
                }}
              />
            ) : (
              <button key={n.id} onClick={() => setEditing(n.id)} className="card group flex items-start gap-4 px-4 py-3 text-left transition-colors hover:bg-white">
                <span className="mt-0.5 w-[72px] shrink-0 font-mono text-[10.5px] tracking-wide text-zinc-400 uppercase">{n.kind}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-medium text-zinc-900">{n.title}</span>
                  {n.detail ? <span className="mt-0.5 block text-[13px] leading-relaxed text-zinc-500">{n.detail}</span> : null}
                </span>
                <span className="shrink-0 font-mono text-[10.5px] text-zinc-400">{ago(n.updatedAt)}</span>
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function MemoryForm({
  node,
  nodes,
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  node?: MemoryNode;
  nodes: MemoryNode[];
  initial?: MemoryDraft;
  onSave: (d: MemoryDraft) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
}) {
  const [d, setD] = useState<MemoryDraft>({ kind: node?.kind ?? initial?.kind ?? "note", title: node?.title ?? "", detail: node?.detail ?? "", links: node?.links ?? [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const others = nodes.filter((n) => n.id !== node?.id);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!d.title?.trim()) return setError("Add a title");
    setBusy(true);
    setError(undefined);
    try {
      await onSave(d);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel className="rise p-5">
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
        <div className="grid grid-cols-[160px_1fr] gap-3">
          <Field label="Type">
            <select className={inputClass} value={d.kind} onChange={(e) => setD((x) => ({ ...x, kind: e.target.value as MemoryKind }))}>
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Title">
            <input className={inputClass} value={d.title} onChange={(e) => setD((x) => ({ ...x, title: e.target.value }))} placeholder="e.g. Q4 close, AC-INV-2307, Contoso" autoFocus />
          </Field>
        </div>
        <Field label="Detail">
          <textarea
            className={cx(inputClass, "h-auto min-h-[72px] py-2 leading-relaxed")}
            value={d.detail}
            onChange={(e) => setD((x) => ({ ...x, detail: e.target.value }))}
            placeholder="What the agent should know"
          />
        </Field>
        {others.length ? (
          <Field label="Related">
            <div className="flex flex-wrap gap-1.5">
              {others.map((o) => {
                const on = d.links?.includes(o.id);
                return (
                  <button
                    type="button"
                    key={o.id}
                    onClick={() => setD((x) => ({ ...x, links: on ? x.links?.filter((l) => l !== o.id) : [...(x.links ?? []), o.id] }))}
                    className={cx("h-7 px-2.5 text-[12.5px] transition-colors", on ? "bg-zinc-900 text-zinc-50" : "bg-zinc-900/[0.05] text-zinc-600 hover:bg-zinc-900/[0.09]")}
                  >
                    {o.title}
                  </button>
                );
              })}
            </div>
          </Field>
        ) : null}
        <div className="mt-1 flex items-center gap-2">
          <Button type="submit" variant="primary" loading={busy}>
            Save
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          {error ? <span className="text-[12.5px] text-rose-600">{error}</span> : null}
          <span className="flex-1" />
          {onDelete ? (
            <Button type="button" variant="danger" onClick={() => void onDelete()}>
              Delete
            </Button>
          ) : null}
        </div>
      </form>
    </Panel>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10.5px] tracking-wide text-zinc-500 uppercase">{label}</span>
      {children}
    </label>
  );
}
