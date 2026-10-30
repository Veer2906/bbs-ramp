import "server-only";
import type { NewRunEvent, Run, RunEvent, StreamMessage } from "../types";
import { store } from "./store";

export type CredentialReply = { vaultId: string } | { skipped: true; note?: string };

interface Live {
  run: Run;
  listeners: Set<(m: StreamMessage) => void>;
  inbox: string[];
  question?: { qid: string; resolve: (answer: string) => void };
  credential?: { rid: string; resolve: (r: CredentialReply) => void };
  abort: AbortController;
  frame?: { image: string; url: string; title: string };
  saveTimer?: ReturnType<typeof setTimeout>;
  saving?: Promise<void>;
}

type G = { __runs?: Map<string, Live>; __dataListeners?: Set<() => void> };
const g = globalThis as G;
const live = (g.__runs ??= new Map());
const dataListeners = (g.__dataListeners ??= new Set());

export const runs = {
  get: (id: string) => live.get(id),
  active(): Live | undefined {
    for (const l of live.values()) if (["starting", "running", "waiting"].includes(l.run.status)) return l;
    return undefined;
  },
  register(run: Run) {
    const l: Live = { run, listeners: new Set(), inbox: [], abort: new AbortController() };
    live.set(run.id, l);
    return l;
  },
  async load(id: string): Promise<Run | undefined> {
    return live.get(id)?.run ?? (await store.run(id));
  },
  subscribe(id: string, fn: (m: StreamMessage) => void) {
    const l = live.get(id);
    if (!l) return () => undefined;
    l.listeners.add(fn);
    return () => l.listeners.delete(fn);
  },
  onData(fn: () => void) {
    dataListeners.add(fn);
    return () => dataListeners.delete(fn);
  },
};

function broadcast(l: Live, m: StreamMessage) {
  for (const fn of l.listeners) {
    try {
      fn(m);
    } catch {
      /* listener went away */
    }
  }
}

// Saves are serialized per run so a slow write can't land after a newer one.
function save(l: Live) {
  l.saving = (l.saving ?? Promise.resolve())
    .then(() => store.saveRun(l.run))
    .catch((e) => console.error(`saving run ${l.run.id} failed:`, e instanceof Error ? e.message : e));
  return l.saving;
}

export function persist(l: Live, now = false) {
  l.run.updatedAt = Date.now();
  if (l.saveTimer) clearTimeout(l.saveTimer);
  if (now) void save(l);
  else l.saveTimer = setTimeout(() => void save(l), 400);
}

export function emit(l: Live, e: NewRunEvent): RunEvent {
  const last = l.run.events[l.run.events.length - 1];
  const event = { ...e, id: (last?.id ?? 0) + 1, t: Date.now() } as RunEvent;
  l.run.events.push(event);
  broadcast(l, { type: "event", event });
  persist(l);
  return event;
}

export function updateEvent(l: Live, event: RunEvent) {
  broadcast(l, { type: "event-update", event });
  persist(l);
}

export function pushRun(l: Live) {
  const { events: _events, ...rest } = l.run;
  void _events;
  broadcast(l, { type: "run", run: rest });
  persist(l);
}

export function pushFrame(l: Live, frame: { image: string; url: string; title: string }) {
  l.frame = frame;
  l.run.browser = { url: frame.url, title: frame.title };
  broadcast(l, { type: "frame", ...frame });
}

export function dataChanged(l?: Live) {
  if (l) broadcast(l, { type: "data" });
  for (const fn of dataListeners) fn();
}

export type { Live };
