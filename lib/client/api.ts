import type { FinancialDocument, Issue, LedgerEntry, PublicSettings, Run, RunSummary } from "../types";

export interface ModelOption {
  id: string;
  label: string;
  hint: string;
}

export interface SettingsPayload {
  settings: PublicSettings;
  models: Record<"anthropic" | "bedrock", ModelOption[]>;
}

export interface DataPayload {
  documents: FinancialDocument[];
  issues: Issue[];
  ledger: LedgerEntry[];
}

export interface WorkspaceState {
  state: "idle" | "provisioning" | "ready" | "error";
  sailboxId?: string;
  message?: string;
}

async function call<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.json !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  runs: () => call<RunSummary[]>("/api/runs"),
  run: (id: string) => call<Run & { frame?: { image: string; url: string; title: string } }>(`/api/runs/${id}`),
  start: (instruction: string) => call<RunSummary>("/api/runs", { method: "POST", json: { instruction } }),
  message: (id: string, text: string) => call(`/api/runs/${id}/message`, { method: "POST", json: { text } }),
  stop: (id: string) => call(`/api/runs/${id}/stop`, { method: "POST" }),
  deleteRun: (id: string) => call(`/api/runs/${id}`, { method: "DELETE" }),
  data: () => call<DataPayload>("/api/data"),
  updateDocument: (id: string, patch: Partial<FinancialDocument>) => call<FinancialDocument>(`/api/documents/${id}`, { method: "PATCH", json: patch }),
  updateIssue: (id: string, status: Issue["status"]) => call<Issue>(`/api/issues/${id}`, { method: "PATCH", json: { status } }),
  settings: () => call<SettingsPayload>("/api/settings"),
  saveSettings: (s: unknown) => call<SettingsPayload>("/api/settings", { method: "PUT", json: s }),
  workspace: () => call<WorkspaceState>("/api/workspace"),
  warmWorkspace: () => call<WorkspaceState>("/api/workspace", { method: "POST" }),
  importLedger: (csv: string) => call<LedgerEntry[]>("/api/ledger", { method: "PUT", json: { csv } }),
  reset: () => call("/api/reset", { method: "POST" }),
};

export const money = (n: number | undefined, currency = "USD") =>
  n === undefined || Number.isNaN(n) ? "—" : n.toLocaleString("en-US", { style: "currency", currency });

export const docTypeLabel: Record<FinancialDocument["type"], string> = {
  invoice: "Invoice",
  purchase_order: "Purchase order",
  receipt: "Receipt",
  credit_memo: "Credit memo",
  statement: "Statement",
  other: "Document",
};

export function ago(t: number) {
  const s = Math.max(1, Math.round((Date.now() - t) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function duration(ms: number) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

export function shortDate(d?: string) {
  if (!d) return "—";
  const dt = new Date(`${d}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
