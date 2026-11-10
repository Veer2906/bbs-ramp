import "server-only";
import { randomUUID } from "node:crypto";
import type { MemoryNode, Settings, VaultEntry } from "../types";
import type { Backend } from "./db/backend";
import { seal } from "./crypto";
import { DEMO_LEDGER, DEMO_LOGINS, DEMO_PORTALS, DEMO_VERSION, demoMemory } from "./demo";

const VERSION_KEY = "demo_seed_version";
const sameUrl = (a: string, b: string) => a.replace(/\/+$/, "") === b.replace(/\/+$/, "");

/** Repair old/partial seeds; write the version last so failures can be retried.
 * Only exact sandbox URLs qualify. Explicit restore also repairs edited demo credentials.
 */
export async function seedDemo(b: Backend, restore = false) {
  if (!restore && (await b.getState<number>(VERSION_KEY) ?? 0) >= DEMO_VERSION) return;
  const settings = await b.getState<Partial<Settings>>("settings");
  let portals = settings?.portals ?? DEMO_PORTALS;
  if (restore) {
    portals = [...portals];
    for (const demo of DEMO_PORTALS) {
      if (portals.some((p) => sameUrl(p.url, demo.url))) continue;
      let id = demo.id;
      for (let suffix = 1; portals.some((p) => p.id === id); suffix++) id = `demo_${demo.id}_${suffix}`;
      portals.push({ ...demo, id });
    }
    await b.setState("settings", { ...settings, portals });
  }
  const enabled = DEMO_PORTALS.filter((p) => portals.some((configured) => sameUrl(configured.url, p.url)));
  const vault = await b.vault();
  for (const p of enabled) {
    const login = DEMO_LOGINS.find((l) => l.portalId === p.id)!;
    const existing = vault.find((v) => sameUrl(v.url, p.url));
    if (existing?.passwordCiphertext && !restore) continue;
    const now = Date.now();
    // Stable ids make retries upserts. Never overwrite an unrelated row with a colliding id.
    const preferredId = `vault_demo_${p.id}`;
    const vid = existing?.id ?? (vault.some((v) => v.id === preferredId) ? `${preferredId}_${randomUUID()}` : preferredId);
    const entry: VaultEntry = {
      ...existing, id: vid, name: p.name, url: p.url, username: login.username,
      passwordCiphertext: seal(login.password, vid), createdAt: existing?.createdAt ?? now, updatedAt: now,
    };
    await b.putVault(entry);
  }
  if (enabled.length) {
    await b.seedLedger(DEMO_LEDGER.filter((e) => enabled.some((p) => p.name === e.vendor)));
    const memory = (await b.getState<MemoryNode[]>("memory")) ?? [];
    const defaults = demoMemory();
    const ids = new Set(defaults.map((m) => m.id));
    const restored = restore ? memory.filter((m) => !ids.has(m.id)) : memory;
    const existing = new Map(defaults.map((m) => [m.id, restored.find((n) => n.id === m.id || n.title.toLowerCase() === m.title.toLowerCase())]));
    const missing = defaults
      .filter((m) => !existing.get(m.id))
      .map((m) => ({ ...m, links: m.links.map((id) => existing.get(id)?.id ?? id) }));
    await b.setState("memory", [...restored, ...missing]);
  }
  await b.setState(VERSION_KEY, DEMO_VERSION);
}
