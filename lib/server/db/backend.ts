import type { FinancialDocument, Issue, LedgerEntry, Run, RunSummary, StorageKind, VaultEntry } from "../../types";

/** Persistence used by the server. Implemented by Supabase (Postgres + Storage). */
export interface Backend {
  kind: StorageKind;
  target: string;
  init(): Promise<void>;

  getState<T>(key: string): Promise<T | undefined>;
  setState(key: string, value: unknown): Promise<void>;

  ledger(): Promise<LedgerEntry[]>;
  replaceLedger(entries: LedgerEntry[]): Promise<void>;
  /** Insert missing demo rows without overwriting any existing ledger entries. */
  seedLedger(entries: LedgerEntry[]): Promise<void>;

  documents(): Promise<FinancialDocument[]>;
  insertDocument(doc: FinancialDocument): Promise<void>;
  updateDocument(id: string, patch: Partial<FinancialDocument>): Promise<FinancialDocument | undefined>;
  deleteDocument(id: string): Promise<void>;

  issues(): Promise<Issue[]>;
  insertIssue(issue: Issue): Promise<void>;
  updateIssue(id: string, patch: Partial<Issue>): Promise<Issue | undefined>;
  deleteIssue(id: string): Promise<void>;

  run(id: string): Promise<Run | undefined>;
  runs(): Promise<RunSummary[]>;
  saveRun(run: Run): Promise<void>;
  deleteRun(id: string): Promise<void>;

  vault(): Promise<VaultEntry[]>;
  putVault(entry: VaultEntry): Promise<void>;
  deleteVault(id: string): Promise<void>;

  putFile(name: string, data: Buffer, contentType: string): Promise<void>;
  getFile(name: string): Promise<Buffer | undefined>;

  /** Removes documents, issues, runs and stored files. Ledger, settings and vault are kept. */
  clearWorkspace(): Promise<void>;
}

export class StorageSetupError extends Error {}
