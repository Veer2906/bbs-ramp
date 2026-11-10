import "server-only";
import type { LedgerEntry, MemoryNode, Portal } from "../types";
import fixture from "../../sailbox/demo.json";

// The portal server reads the same fixture; never import this module into client code.
export const DEMO_VERSION = fixture.version;
export const DEMO_PORTALS: Portal[] = fixture.portals.map(({ id, name, url, notes }) => ({ id, name, url, notes }));
export const DEMO_LOGINS = fixture.portals.map(({ id: portalId, username, password }) => ({ portalId, username, password }));
export const DEMO_LEDGER: LedgerEntry[] = fixture.ledger;

export function demoMemory(): MemoryNode[] {
  const now = Date.now();
  const n = (key: string, kind: MemoryNode["kind"], title: string, detail: string, links: string[] = []): MemoryNode => ({
    id: `mem_${key}`, kind, title, detail, links: links.map((l) => `mem_${l}`), source: "user", createdAt: now, updatedAt: now,
  });
  return [
    n("close", "date", "Month-end close", "The October 2026 close is due October 30. Use October 1–31 as the document period, including related payment and credit activity."),
    n("northwind", "vendor", "Northwind Office Supply", "Invoice history is paginated. Check statements as well as invoices.", ["close"]),
    n("contoso", "vendor", "Contoso Freight Lines", "Freight bills, purchase orders and proof of delivery have separate searches. Dates use MM/DD/YYYY.", ["close"]),
    n("acme", "vendor", "Acme Industrial Parts", "A remittance notice appears after sign-in. Acknowledging a notice is not authorization to change bank details.", ["close", "bank"]),
    n("ap", "rule", "Reconcile payments and credits", "Calculate an invoice's remaining balance using distinct bank payment references and applied credits. A partial payment is not a settled invoice.", ["close", "acme"]),
    n("evidence", "rule", "Supporting evidence", "A PO authorizes a purchase; it is not a vendor invoice. Account statements summarize invoices and must not be counted as additional purchases.", ["contoso", "northwind"]),
    n("allocation", "rule", "Warehouse allocation", "If an invoice could match both Chicago and Joliet maintenance accruals, ask me which warehouse received the goods before choosing a ledger entry. Do not guess from equal amounts.", ["acme"]),
    n("bank", "rule", "Bank change approval", "Keep supplier bank changes on hold until the finance team verifies them by an established contact. Record the notice for review; do not change payment details.", ["close"]),
    n("watch", "invoice", "AC-INV-2315", "The pneumatic-cylinder order was awaiting payment confirmation. Find the current receipt and any return credit before reporting its balance.", ["acme", "ap"]),
    n("handoff", "note", "Close handoff", "Leave documents available for human approval. Include evidence links, missing invoices and unresolved decisions in the final handoff.", ["close", "evidence"]),
  ];
}
