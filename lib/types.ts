export type DocType = "invoice" | "purchase_order" | "receipt" | "credit_memo" | "statement" | "other";

export type DocStatus = "extracted" | "matched" | "needs_review" | "approved" | "rejected";

export interface LineItem {
  description: string;
  quantity?: number;
  unit_price?: number;
  amount?: number;
}

export interface FinancialDocument {
  id: string;
  runId: string;
  type: DocType;
  vendor: string;
  number: string;
  date?: string;
  dueDate?: string;
  amount?: number;
  currency: string;
  poNumber?: string;
  reference?: string;
  lineItems: LineItem[];
  sourceUrl?: string;
  fileName?: string;
  sailPath?: string;
  status: DocStatus;
  ledgerId?: string;
  matchConfidence?: "exact" | "probable" | "uncertain";
  notes?: string;
  createdAt: number;
}

export interface LedgerEntry {
  id: string;
  date: string;
  vendor: string;
  description: string;
  amount: number;
  poNumber?: string;
  reference?: string;
}

export type IssueKind =
  | "missing_document"
  | "amount_mismatch"
  | "duplicate"
  | "ambiguous"
  | "unrecorded"
  | "access"
  | "other";

export interface Issue {
  id: string;
  runId: string;
  kind: IssueKind;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  ledgerId?: string;
  documentIds: string[];
  status: "open" | "resolved";
  createdAt: number;
}

export interface Portal {
  id: string;
  name: string;
  url: string;
  username: string;
  password: string;
  notes?: string;
}

export type PublicPortal = Omit<Portal, "password"> & { hasPassword: boolean };

export type Provider = "anthropic" | "bedrock";

export interface Settings {
  provider: Provider;
  anthropicModel: string;
  bedrockModel: string;
  bedrockRegion: string;
  portals: Portal[];
}

export type PublicSettings = Omit<Settings, "portals"> & {
  portals: PublicPortal[];
  available: { anthropic: boolean; bedrock: boolean; sail: boolean };
};

export interface PlanStep {
  title: string;
  status: "pending" | "active" | "done" | "skipped";
}

export type RunStatus = "starting" | "running" | "waiting" | "done" | "failed" | "stopped";

export type RunEvent =
  | { id: number; t: number; kind: "user"; text: string }
  | { id: number; t: number; kind: "note"; text: string }
  | { id: number; t: number; kind: "action"; tool: string; label: string; ok?: boolean; detail?: string; ms?: number }
  | { id: number; t: number; kind: "document"; documentId: string; label: string }
  | { id: number; t: number; kind: "match"; documentId: string; ledgerId: string; label: string }
  | { id: number; t: number; kind: "issue"; issueId: string; label: string; severity: Issue["severity"] }
  | { id: number; t: number; kind: "question"; qid: string; text: string; options: string[]; answer?: string }
  | { id: number; t: number; kind: "status"; text: string }
  | { id: number; t: number; kind: "error"; text: string }
  | { id: number; t: number; kind: "summary"; text: string };

export type NewRunEvent = RunEvent extends infer E ? (E extends RunEvent ? Omit<E, "id" | "t"> : never) : never;

export interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  costUsd: number;
  turns: number;
}

export interface Run {
  id: string;
  title: string;
  instruction: string;
  status: RunStatus;
  provider: Provider;
  model: string;
  createdAt: number;
  updatedAt: number;
  events: RunEvent[];
  plan: PlanStep[];
  usage: Usage;
  browser?: { url: string; title: string };
}

export type RunSummary = Pick<Run, "id" | "title" | "status" | "createdAt" | "updatedAt" | "model" | "usage">;

export type StreamMessage =
  | { type: "event"; event: RunEvent }
  | { type: "event-update"; event: RunEvent }
  | { type: "run"; run: Omit<Run, "events"> }
  | { type: "frame"; image: string; url: string; title: string }
  | { type: "data" };
