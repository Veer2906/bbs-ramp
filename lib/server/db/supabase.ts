import "server-only";
import fs from "node:fs";
import path from "node:path";
import { createClient, type PostgrestError } from "@supabase/supabase-js";
import type { FinancialDocument, Issue, LedgerEntry, Run, RunSummary, VaultEntry } from "../../types";
import { StorageSetupError, type Backend } from "./backend";

type Row = Record<string, unknown>;

const iso = (ms: number | undefined) => (ms === undefined ? null : new Date(ms).toISOString());
const ms = (v: unknown) => (typeof v === "string" ? Date.parse(v) : undefined);
const num = (v: unknown) => (v === null || v === undefined ? undefined : Number(v));
const opt = <T>(v: T | null | undefined) => (v === null ? undefined : v);

const docRow = (d: Partial<FinancialDocument>): Row =>
  strip({
    id: d.id,
    run_id: d.runId,
    type: d.type,
    vendor: d.vendor,
    number: d.number,
    date: d.date,
    due_date: d.dueDate,
    amount: d.amount,
    currency: d.currency,
    po_number: d.poNumber,
    reference: d.reference,
    line_items: d.lineItems,
    source_url: d.sourceUrl,
    file_name: d.fileName,
    sail_path: d.sailPath,
    status: d.status,
    ledger_id: d.ledgerId,
    match_confidence: d.matchConfidence,
    notes: d.notes,
    created_at: d.createdAt === undefined ? undefined : iso(d.createdAt),
  }, d);

const docFrom = (r: Row): FinancialDocument => ({
  id: String(r.id),
  runId: String(r.run_id ?? ""),
  type: r.type as FinancialDocument["type"],
  vendor: String(r.vendor),
  number: String(r.number),
  date: opt(r.date as string),
  dueDate: opt(r.due_date as string),
  amount: num(r.amount),
  currency: String(r.currency ?? "USD"),
  poNumber: opt(r.po_number as string),
  reference: opt(r.reference as string),
  lineItems: (r.line_items as FinancialDocument["lineItems"]) ?? [],
  sourceUrl: opt(r.source_url as string),
  fileName: opt(r.file_name as string),
  sailPath: opt(r.sail_path as string),
  status: r.status as FinancialDocument["status"],
  ledgerId: opt(r.ledger_id as string),
  matchConfidence: opt(r.match_confidence as FinancialDocument["matchConfidence"]),
  notes: opt(r.notes as string),
  createdAt: ms(r.created_at) ?? Date.now(),
});

const issueRow = (i: Partial<Issue>): Row =>
  strip({
    id: i.id,
    run_id: i.runId,
    kind: i.kind,
    severity: i.severity,
    title: i.title,
    detail: i.detail,
    ledger_id: i.ledgerId,
    document_ids: i.documentIds,
    status: i.status,
    created_at: i.createdAt === undefined ? undefined : iso(i.createdAt),
  }, i);

const issueFrom = (r: Row): Issue => ({
  id: String(r.id),
  runId: String(r.run_id ?? ""),
  kind: r.kind as Issue["kind"],
  severity: r.severity as Issue["severity"],
  title: String(r.title),
  detail: String(r.detail ?? ""),
  ledgerId: opt(r.ledger_id as string),
  documentIds: (r.document_ids as string[]) ?? [],
  status: r.status as Issue["status"],
  createdAt: ms(r.created_at) ?? Date.now(),
});

const ledgerRow = (e: LedgerEntry): Row => ({
  id: e.id,
  date: e.date,
  vendor: e.vendor,
  description: e.description,
  amount: e.amount,
  po_number: e.poNumber ?? null,
  reference: e.reference ?? null,
});

const ledgerFrom = (r: Row): LedgerEntry => ({
  id: String(r.id),
  date: String(r.date),
  vendor: String(r.vendor),
  description: String(r.description ?? ""),
  amount: Number(r.amount),
  poNumber: opt(r.po_number as string),
  reference: opt(r.reference as string),
});

const RUN_SUMMARY = "id,title,status,model,usage,created_at,updated_at";

const runFrom = (r: Row): Run => ({
  id: String(r.id),
  title: String(r.title),
  instruction: String(r.instruction ?? ""),
  status: r.status as Run["status"],
  provider: r.provider as Run["provider"],
  model: String(r.model),
  usage: r.usage as Run["usage"],
  plan: (r.plan as Run["plan"]) ?? [],
  events: (r.events as Run["events"]) ?? [],
  browser: opt(r.browser as Run["browser"]),
  createdAt: ms(r.created_at) ?? Date.now(),
  updatedAt: ms(r.updated_at) ?? Date.now(),
});

const vaultRow = (e: VaultEntry): Row => ({
  id: e.id,
  name: e.name,
  url: e.url,
  username: e.username,
  password_ciphertext: e.passwordCiphertext ?? null,
  created_at: iso(e.createdAt),
  updated_at: iso(e.updatedAt),
  last_used_at: iso(e.lastUsedAt),
});

const vaultFrom = (r: Row): VaultEntry => ({
  id: String(r.id),
  name: String(r.name),
  url: String(r.url ?? ""),
  username: String(r.username ?? ""),
  passwordCiphertext: opt(r.password_ciphertext as string),
  createdAt: ms(r.created_at) ?? Date.now(),
  updatedAt: ms(r.updated_at) ?? Date.now(),
  lastUsedAt: ms(r.last_used_at),
});

/** Keep only columns whose camelCase source key was present, so partial patches don't null other fields. */
function strip(row: Row, source: object): Row {
  const keys = new Set(Object.keys(source));
  const map: Record<string, string> = {
    run_id: "runId",
    due_date: "dueDate",
    po_number: "poNumber",
    line_items: "lineItems",
    source_url: "sourceUrl",
    file_name: "fileName",
    sail_path: "sailPath",
    ledger_id: "ledgerId",
    match_confidence: "matchConfidence",
    document_ids: "documentIds",
    created_at: "createdAt",
  };
  const out: Row = {};
  for (const [col, v] of Object.entries(row)) {
    if (!keys.has(map[col] ?? col)) continue;
    out[col] = v === undefined ? null : v;
  }
  return out;
}

const MISSING_TABLE = new Set(["PGRST205", "42P01"]);

function check<T>(res: { data: T; error: PostgrestError | null }, what: string): T {
  if (res.error) {
    if (MISSING_TABLE.has(res.error.code)) throw new StorageSetupError(setupHint());
    throw new Error(`Supabase ${what} failed: ${res.error.message}`);
  }
  return res.data;
}

const migrationsDir = () => path.join(process.cwd(), "supabase", "migrations");

function setupHint() {
  return "Supabase is connected but its tables are missing. Paste supabase/migrations/*.sql into the Supabase SQL editor, or set SUPABASE_DB_URL so the app creates them.";
}

async function migrate(dbUrl: string) {
  const { default: postgres } = await import("postgres");
  const sql = postgres(dbUrl, { max: 1, prepare: false, onnotice: () => undefined });
  try {
    for (const f of fs.readdirSync(migrationsDir()).filter((f) => f.endsWith(".sql")).sort()) {
      await sql.unsafe(fs.readFileSync(path.join(migrationsDir(), f), "utf8"));
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

/** Supabase Postgres for records and a private Storage bucket for document files. Server-only, service-role key. */
export function supabaseBackend(opts: { url: string; key: string; dbUrl?: string; bucket: string }): Backend {
  const db = createClient(opts.url, opts.key, { auth: { persistSession: false, autoRefreshToken: false } });
  const bucket = () => db.storage.from(opts.bucket);

  async function all(table: string, columns = "*", order = "created_at"): Promise<Row[]> {
    const out: Row[] = [];
    for (let from = 0; ; from += 1000) {
      const rows = check(await db.from(table).select(columns).order(order).range(from, from + 999), `read ${table}`) as unknown as Row[];
      out.push(...rows);
      if (rows.length < 1000) return out;
    }
  }

  return {
    kind: "supabase",
    target: new URL(opts.url).host,

    async init() {
      const probe = await db.from("vault_entries").select("id").limit(1);
      if (probe.error && MISSING_TABLE.has(probe.error.code)) {
        if (!opts.dbUrl) throw new StorageSetupError(setupHint());
        await migrate(opts.dbUrl);
        for (let i = 0; i < 20; i++) {
          const again = await db.from("vault_entries").select("id").limit(1);
          if (!again.error) break;
          if (i === 19) throw new StorageSetupError(`Created the tables but Supabase cannot see them yet: ${again.error.message}`);
          await new Promise((r) => setTimeout(r, 500));
        }
      } else if (probe.error) {
        throw new StorageSetupError(`Cannot reach Supabase: ${probe.error.message}`);
      }
      const b = await db.storage.getBucket(opts.bucket);
      if (b.error) {
        const made = await db.storage.createBucket(opts.bucket, { public: false });
        if (made.error && !/exists/i.test(made.error.message)) throw new StorageSetupError(`Cannot create the ${opts.bucket} storage bucket: ${made.error.message}`);
      }
    },

    async getState<T>(key: string) {
      const rows = check(await db.from("app_state").select("value").eq("key", key).limit(1), "read state") as Row[];
      return rows[0]?.value as T | undefined;
    },
    async setState(key, value) {
      check(await db.from("app_state").upsert({ key, value, updated_at: new Date().toISOString() }), "write state");
    },

    async ledger() {
      return (await all("ledger_entries", "*", "date")).map(ledgerFrom);
    },
    async replaceLedger(entries) {
      check(await db.from("ledger_entries").delete().neq("id", ""), "clear ledger");
      for (let i = 0; i < entries.length; i += 500) {
        check(await db.from("ledger_entries").insert(entries.slice(i, i + 500).map(ledgerRow)), "write ledger");
      }
    },

    async documents() {
      return (await all("documents")).map(docFrom);
    },
    async insertDocument(doc) {
      check(await db.from("documents").insert(docRow(doc)), "save document");
    },
    async updateDocument(id, patch) {
      const { id: _id, ...rest } = patch;
      void _id;
      const rows = check(await db.from("documents").update(docRow(rest)).eq("id", id).select(), "update document") as Row[];
      return rows[0] ? docFrom(rows[0]) : undefined;
    },
    async deleteDocument(id) {
      check(await db.from("documents").delete().eq("id", id), "delete document");
    },

    async issues() {
      return (await all("issues")).map(issueFrom);
    },
    async insertIssue(issue) {
      check(await db.from("issues").insert(issueRow(issue)), "save issue");
    },
    async updateIssue(id, patch) {
      const { id: _id, ...rest } = patch;
      void _id;
      const rows = check(await db.from("issues").update(issueRow(rest)).eq("id", id).select(), "update issue") as Row[];
      return rows[0] ? issueFrom(rows[0]) : undefined;
    },

    async run(id) {
      const rows = check(await db.from("runs").select("*").eq("id", id).limit(1), "read run") as Row[];
      return rows[0] ? runFrom(rows[0]) : undefined;
    },
    async runs(): Promise<RunSummary[]> {
      const rows = check(await db.from("runs").select(RUN_SUMMARY).order("created_at", { ascending: false }).limit(200), "list runs") as unknown as Row[];
      return rows.map((r) => {
        const { events: _e, plan: _p, instruction: _i, provider: _v, browser: _b, ...s } = runFrom(r);
        void [_e, _p, _i, _v, _b];
        return s;
      });
    },
    async saveRun(run) {
      check(
        await db.from("runs").upsert({
          id: run.id,
          title: run.title,
          instruction: run.instruction,
          status: run.status,
          provider: run.provider,
          model: run.model,
          usage: run.usage,
          plan: run.plan,
          events: run.events,
          browser: run.browser ?? null,
          created_at: iso(run.createdAt),
          updated_at: iso(run.updatedAt),
        }),
        "save run"
      );
    },
    async deleteRun(id) {
      check(await db.from("runs").delete().eq("id", id), "delete run");
    },

    async vault() {
      return (await all("vault_entries")).map(vaultFrom);
    },
    async putVault(entry) {
      check(await db.from("vault_entries").upsert(vaultRow(entry)), "save vault entry");
    },
    async deleteVault(id) {
      check(await db.from("vault_entries").delete().eq("id", id), "delete vault entry");
    },

    async putFile(name, data, contentType) {
      const { error } = await bucket().upload(name, data, { contentType, upsert: true });
      if (error) throw new Error(`Supabase Storage upload failed: ${error.message}`);
    },
    async getFile(name) {
      const { data, error } = await bucket().download(name);
      if (error || !data) return undefined;
      return Buffer.from(await data.arrayBuffer());
    },

    async clearWorkspace() {
      for (const t of ["documents", "issues", "runs"]) check(await db.from(t).delete().neq("id", ""), `clear ${t}`);
      for (;;) {
        const { data } = await bucket().list("", { limit: 1000 });
        const names = (data ?? []).filter((f) => f.id).map((f) => f.name);
        if (!names.length) break;
        await bucket().remove(names);
        if (names.length < 1000) break;
      }
    },
  };
}
