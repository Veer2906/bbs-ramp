import "server-only";
import fs from "node:fs";
import path from "node:path";
import { env } from "./env";
import type { FinancialDocument, Issue, LedgerEntry, Run, Settings } from "../types";
import { DEMO_LEDGER, DEMO_PORTALS } from "./demo";

const dir = () => env.dataDir();

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function readJson<T>(file: string, fallback: () => T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback();
  }
}

function writeJson(file: string, value: unknown) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

export const id = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const defaultSettings = (): Settings => ({
  provider: "anthropic",
  anthropicModel: "claude-sonnet-5-5",
  bedrockModel: "global.anthropic.claude-sonnet-4-6",
  bedrockRegion: env.awsRegion(),
  portals: DEMO_PORTALS,
});

export const store = {
  file: (name: string) => path.join(dir(), name),
  filesDir: () => {
    const p = path.join(dir(), "files");
    ensureDir(p);
    return p;
  },

  settings(): Settings {
    return { ...defaultSettings(), ...readJson<Partial<Settings>>(this.file("settings.json"), () => ({})) };
  },
  saveSettings(s: Settings) {
    writeJson(this.file("settings.json"), s);
  },

  ledger(): LedgerEntry[] {
    return readJson(this.file("ledger.json"), () => DEMO_LEDGER);
  },
  saveLedger(entries: LedgerEntry[]) {
    writeJson(this.file("ledger.json"), entries);
  },

  documents(): FinancialDocument[] {
    return readJson(this.file("documents.json"), () => []);
  },
  saveDocuments(docs: FinancialDocument[]) {
    writeJson(this.file("documents.json"), docs);
  },
  updateDocument(docId: string, patch: Partial<FinancialDocument>) {
    const docs = this.documents();
    const i = docs.findIndex((d) => d.id === docId);
    if (i < 0) return undefined;
    docs[i] = { ...docs[i], ...patch };
    this.saveDocuments(docs);
    return docs[i];
  },

  issues(): Issue[] {
    return readJson(this.file("issues.json"), () => []);
  },
  saveIssues(issues: Issue[]) {
    writeJson(this.file("issues.json"), issues);
  },

  run(runId: string): Run | undefined {
    if (!/^[\w-]+$/.test(runId)) return undefined;
    return readJson<Run | undefined>(path.join(dir(), "runs", `${runId}.json`), () => undefined);
  },
  saveRun(run: Run) {
    writeJson(path.join(dir(), "runs", `${run.id}.json`), run);
  },
  deleteRun(runId: string) {
    fs.rmSync(path.join(dir(), "runs", `${runId}.json`), { force: true });
  },
  runs(): Run[] {
    const d = path.join(dir(), "runs");
    if (!fs.existsSync(d)) return [];
    return fs
      .readdirSync(d)
      .filter((f) => f.endsWith(".json"))
      .map((f) => readJson<Run | undefined>(path.join(d, f), () => undefined))
      .filter((r): r is Run => Boolean(r))
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  readState<T>(name: string, fallback: T): T {
    return readJson(this.file(name), () => fallback);
  },
  writeState(name: string, value: unknown) {
    writeJson(this.file(name), value);
  },

  resetWorkspaceData() {
    for (const f of ["documents.json", "issues.json"]) fs.rmSync(this.file(f), { force: true });
    fs.rmSync(path.join(dir(), "runs"), { recursive: true, force: true });
    fs.rmSync(path.join(dir(), "files"), { recursive: true, force: true });
  },
};
