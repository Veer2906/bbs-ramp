import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { FinancialDocument, Issue, LedgerEntry, Run, VaultEntry } from "../../types";
import type { Backend } from "./backend";

function readJson<T>(file: string, fallback: () => T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback();
  }
}

function writeJson(file: string, value: unknown, mode?: number) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), mode ? { mode } : undefined);
  fs.renameSync(tmp, file);
}

const safe = (name: string) => /^[\w.-]+$/.test(name);

/** JSON files under AGENT_DATA_DIR (default ./.data). Used when Supabase is not configured. */
export function localBackend(dir: string): Backend {
  const file = (name: string) => path.join(dir, name);
  const runsDir = path.join(dir, "runs");
  const filesDir = path.join(dir, "files");
  const list = <T>(name: string) => readJson<T[]>(file(name), () => []);

  function patchIn<T extends { id: string }>(name: string, id: string, patch: Partial<T>) {
    const all = list<T>(name);
    const i = all.findIndex((x) => x.id === id);
    if (i < 0) return undefined;
    all[i] = { ...all[i], ...patch };
    writeJson(file(name), all);
    return all[i];
  }

  return {
    kind: "local",
    target: dir,
    async init() {
      fs.mkdirSync(dir, { recursive: true });
    },

    async getState<T>(key: string) {
      return readJson<T | undefined>(file(`${key}.json`), () => undefined);
    },
    async setState(key, value) {
      writeJson(file(`${key}.json`), value);
    },

    async ledger() {
      return list<LedgerEntry>("ledger.json");
    },
    async replaceLedger(entries) {
      writeJson(file("ledger.json"), entries);
    },

    async documents() {
      return list<FinancialDocument>("documents.json");
    },
    async insertDocument(doc) {
      writeJson(file("documents.json"), [...list<FinancialDocument>("documents.json"), doc]);
    },
    async updateDocument(id, patch) {
      return patchIn<FinancialDocument>("documents.json", id, patch);
    },
    async deleteDocument(id) {
      writeJson(file("documents.json"), list<FinancialDocument>("documents.json").filter((d) => d.id !== id));
    },

    async issues() {
      return list<Issue>("issues.json");
    },
    async insertIssue(issue) {
      writeJson(file("issues.json"), [...list<Issue>("issues.json"), issue]);
    },
    async updateIssue(id, patch) {
      return patchIn<Issue>("issues.json", id, patch);
    },

    async run(id) {
      if (!safe(id)) return undefined;
      return readJson<Run | undefined>(path.join(runsDir, `${id}.json`), () => undefined);
    },
    async runs() {
      if (!fs.existsSync(runsDir)) return [];
      return fs
        .readdirSync(runsDir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => readJson<Run | undefined>(path.join(runsDir, f), () => undefined))
        .filter((r): r is Run => Boolean(r))
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(({ id, title, status, createdAt, updatedAt, model, usage }) => ({ id, title, status, createdAt, updatedAt, model, usage }));
    },
    async saveRun(run) {
      writeJson(path.join(runsDir, `${run.id}.json`), run);
    },
    async deleteRun(id) {
      if (safe(id)) fs.rmSync(path.join(runsDir, `${id}.json`), { force: true });
    },

    async vault() {
      return list<VaultEntry>("vault.json");
    },
    async putVault(entry) {
      const all = list<VaultEntry>("vault.json").filter((e) => e.id !== entry.id);
      writeJson(file("vault.json"), [...all, entry], 0o600);
    },
    async deleteVault(id) {
      writeJson(file("vault.json"), list<VaultEntry>("vault.json").filter((e) => e.id !== id), 0o600);
    },

    async putFile(name, data) {
      if (!safe(name)) throw new Error("bad file name");
      fs.mkdirSync(filesDir, { recursive: true });
      fs.writeFileSync(path.join(filesDir, name), data);
    },
    async getFile(name) {
      if (!safe(name)) return undefined;
      const p = path.join(filesDir, name);
      return fs.existsSync(p) ? fs.readFileSync(p) : undefined;
    },

    async clearWorkspace() {
      for (const f of ["documents.json", "issues.json"]) fs.rmSync(file(f), { force: true });
      fs.rmSync(runsDir, { recursive: true, force: true });
      fs.rmSync(filesDir, { recursive: true, force: true });
    },
  };
}
