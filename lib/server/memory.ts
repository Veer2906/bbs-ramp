import "server-only";
import type { MemoryKind, MemoryNode } from "../types";
import { id, store } from "./store";

export const MEMORY_KINDS: MemoryKind[] = ["date", "invoice", "vendor", "rule", "note"];

export type MemoryInput = Partial<Pick<MemoryNode, "kind" | "title" | "detail" | "links">>;

const clean = (m: MemoryInput, all: MemoryNode[], self?: string): MemoryInput => ({
  ...(m.kind && MEMORY_KINDS.includes(m.kind) ? { kind: m.kind } : {}),
  ...(m.title !== undefined ? { title: String(m.title).trim().slice(0, 120) } : {}),
  ...(m.detail !== undefined ? { detail: String(m.detail).trim().slice(0, 1000) } : {}),
  ...(Array.isArray(m.links) ? { links: [...new Set(m.links.map(String))].filter((l) => l !== self && all.some((n) => n.id === l)) } : {}),
});

export const listMemory = () => store.memory();

export async function createMemory(m: MemoryInput, source: MemoryNode["source"]): Promise<MemoryNode> {
  const all = await store.memory();
  const c = clean(m, all);
  if (!c.title) throw new Error("Add a title");
  const now = Date.now();
  const node: MemoryNode = { id: id("mem"), kind: c.kind ?? "note", title: c.title, detail: c.detail ?? "", links: c.links ?? [], source, createdAt: now, updatedAt: now };
  await store.saveMemory([...all, node]);
  return node;
}

export async function updateMemory(mid: string, m: MemoryInput): Promise<MemoryNode | undefined> {
  const all = await store.memory();
  const cur = all.find((n) => n.id === mid);
  if (!cur) return undefined;
  const next = { ...cur, ...clean(m, all, mid), updatedAt: Date.now() };
  if (!next.title) throw new Error("Add a title");
  await store.saveMemory(all.map((n) => (n.id === mid ? next : n)));
  return next;
}

export async function deleteMemory(mid: string) {
  const all = await store.memory();
  await store.saveMemory(all.filter((n) => n.id !== mid).map((n) => ({ ...n, links: n.links.filter((l) => l !== mid) })));
}

/** Agent-side upsert: reuse a node with the same title instead of creating near-duplicates. */
export async function rememberFact(m: MemoryInput & { id?: string; link_titles?: string[] }): Promise<{ node: MemoryNode; updated: boolean }> {
  const all = await store.memory();
  const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const links = (m.link_titles ?? []).map((t) => all.find((n) => key(n.title) === key(t))?.id).filter((x): x is string => !!x);
  const existing = (m.id && all.find((n) => n.id === m.id)) || all.find((n) => m.title && key(n.title) === key(m.title));
  if (existing) {
    const node = await updateMemory(existing.id, { ...m, links: [...new Set([...existing.links, ...links])] });
    return { node: node!, updated: true };
  }
  return { node: await createMemory({ ...m, links }, "agent"), updated: false };
}

export function memoryPrompt(nodes: MemoryNode[]) {
  if (!nodes.length) return "(empty)";
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return nodes
    .map((n) => {
      const rel = n.links.map((l) => byId.get(l)?.title).filter(Boolean);
      return `- [${n.kind}] ${n.title}${n.detail ? `: ${n.detail}` : ""}${rel.length ? ` (related: ${rel.join("; ")})` : ""} {${n.id}}`;
    })
    .join("\n");
}
