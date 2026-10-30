import "server-only";
import type { FinancialDocument, Issue, LedgerEntry, Portal, Run, Settings, StorageStatus, VaultEntry } from "../types";
import { seal } from "./crypto";
import { StorageSetupError, type Backend } from "./db/backend";
import { localBackend } from "./db/local";
import { supabaseBackend } from "./db/supabase";
import { DEMO_LEDGER, DEMO_LOGINS, DEMO_PORTALS } from "./demo";
import { env } from "./env";

export const id = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const defaultSettings = (): Settings => ({
  provider: "anthropic",
  anthropicModel: "claude-sonnet-5-5",
  bedrockModel: "global.anthropic.claude-sonnet-4-6",
  bedrockRegion: env.awsRegion(),
  portals: DEMO_PORTALS,
});

type G = { __store?: { config: string; backend: Backend; ready?: Promise<void>; error?: string } };
const g = globalThis as G;

function current() {
  const url = env.supabaseUrl();
  const key = env.supabaseKey();
  const config = url && key ? `supabase:${url}:${key.slice(-6)}:${env.supabaseBucket()}` : `local:${env.dataDir()}`;
  if (g.__store?.config !== config) {
    const backend =
      url && key
        ? supabaseBackend({ url, key, dbUrl: env.supabaseDbUrl(), bucket: env.supabaseBucket() })
        : localBackend(env.dataDir());
    g.__store = { config, backend };
  }
  return g.__store;
}

function ready(): Promise<Backend> {
  const s = current();
  s.ready ??= (async () => {
    await s.backend.init();
    await seed(s.backend);
    s.error = undefined;
  })().catch((e) => {
    s.ready = undefined;
    s.error = e instanceof Error ? e.message : String(e);
    throw e;
  });
  return s.ready.then(() => s.backend);
}

type LegacyPortal = Portal & { username?: string; password?: string };

/** First start: demo ledger, demo portals and their logins (encrypted). Also moves pre-vault portal passwords into the vault. */
async function seed(b: Backend) {
  const stored = await b.getState<Omit<Partial<Settings>, "portals"> & { portals?: LegacyPortal[] }>("settings");
  if (!(await b.getState<boolean>("seeded"))) {
    if (!(await b.ledger()).length) await b.replaceLedger(DEMO_LEDGER);
    if (!(await b.vault()).length) {
      const portals = stored?.portals ?? DEMO_PORTALS;
      for (const login of DEMO_LOGINS) {
        const p = portals.find((x) => x.id === login.portalId);
        if (p) await b.putVault(newVaultEntry(p.name, p.url, login.username, login.password));
      }
    }
    await b.setState("seeded", true);
  }
  const legacy = stored?.portals?.filter((p) => p.password || p.username);
  if (legacy?.length) {
    const vault = await b.vault();
    for (const p of legacy) {
      if (p.password && !vault.some((v) => v.url === p.url)) await b.putVault(newVaultEntry(p.name, p.url, p.username ?? "", p.password));
    }
    await b.setState("settings", { ...stored, portals: stored!.portals!.map(({ username: _u, password: _p, ...rest }) => (void [_u, _p], rest)) });
  }
}

export function newVaultEntry(name: string, url: string, username: string, password?: string): VaultEntry {
  const now = Date.now();
  const vid = id("vault");
  return { id: vid, name, url, username, passwordCiphertext: password ? seal(password, vid) : undefined, createdAt: now, updatedAt: now };
}

export async function storageStatus(): Promise<StorageStatus> {
  const s = current();
  try {
    await ready();
    return { kind: s.backend.kind, ok: true, target: s.backend.target };
  } catch (e) {
    return { kind: s.backend.kind, ok: false, target: s.backend.target, message: e instanceof Error ? e.message : String(e) };
  }
}

export { StorageSetupError };

export const store = {
  async settings(): Promise<Settings> {
    const b = await ready();
    return { ...defaultSettings(), ...((await b.getState<Partial<Settings>>("settings")) ?? {}) };
  },
  async saveSettings(s: Settings) {
    await (await ready()).setState("settings", s);
  },

  async ledger(): Promise<LedgerEntry[]> {
    return (await ready()).ledger();
  },
  async saveLedger(entries: LedgerEntry[]) {
    await (await ready()).replaceLedger(entries);
  },

  async documents(): Promise<FinancialDocument[]> {
    return (await ready()).documents();
  },
  async insertDocument(d: FinancialDocument) {
    await (await ready()).insertDocument(d);
  },
  async updateDocument(docId: string, patch: Partial<FinancialDocument>) {
    return (await ready()).updateDocument(docId, patch);
  },
  async deleteDocument(docId: string) {
    await (await ready()).deleteDocument(docId);
  },

  async issues(): Promise<Issue[]> {
    return (await ready()).issues();
  },
  async insertIssue(i: Issue) {
    await (await ready()).insertIssue(i);
  },
  async updateIssue(issueId: string, patch: Partial<Issue>) {
    return (await ready()).updateIssue(issueId, patch);
  },

  async run(runId: string): Promise<Run | undefined> {
    if (!/^[\w-]+$/.test(runId)) return undefined;
    return (await ready()).run(runId);
  },
  async runs() {
    return (await ready()).runs();
  },
  async saveRun(run: Run) {
    await (await ready()).saveRun(run);
  },
  async deleteRun(runId: string) {
    await (await ready()).deleteRun(runId);
  },

  async vault(): Promise<VaultEntry[]> {
    return (await ready()).vault();
  },
  async putVault(e: VaultEntry) {
    await (await ready()).putVault(e);
  },
  async deleteVault(vid: string) {
    await (await ready()).deleteVault(vid);
  },

  async putFile(name: string, data: Buffer, contentType: string) {
    await (await ready()).putFile(name, data, contentType);
  },
  async getFile(name: string) {
    return (await ready()).getFile(name);
  },

  async readState<T>(key: string, fallback: T): Promise<T> {
    return ((await (await ready()).getState<T>(key)) ?? fallback) as T;
  },
  async writeState(key: string, value: unknown) {
    await (await ready()).setState(key, value);
  },

  async resetWorkspace() {
    const b = await ready();
    await b.clearWorkspace();
    await b.replaceLedger(DEMO_LEDGER);
  },
};
