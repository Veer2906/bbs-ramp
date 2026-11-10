import type { FinancialDocument, Issue, LedgerEntry } from "../types";
import type { DataPayload } from "./api";

export type LedgerState = "matched" | "review" | "missing";

export interface LedgerRow {
  entry: LedgerEntry;
  docs: FinancialDocument[];
  issues: Issue[];
  state: LedgerState;
}

/** Each ledger line with the documents that support it and whether a person still needs to look. */
export function reconcile(data: DataPayload): LedgerRow[] {
  return data.ledger.map((entry) => {
    const docs = data.documents.filter((d) => d.ledgerId === entry.id && d.status !== "rejected");
    const issues = data.issues.filter((i) => i.ledgerId === entry.id && i.status === "open");
    const state: LedgerState = !docs.length
      ? "missing"
      : issues.length || docs.some((d) => d.status === "needs_review" || d.status === "extracted")
        ? "review"
        : "matched";
    return { entry, docs, issues, state };
  });
}

/** "October" when every ledger line falls in one month, otherwise undefined. */
export function ledgerMonth(ledger: LedgerEntry[]): string | undefined {
  const months = new Set(ledger.map((e) => e.date.slice(0, 7)));
  if (months.size !== 1) return undefined;
  const d = new Date(`${[...months][0]}-01T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d.toLocaleDateString("en-US", { month: "long" });
}
