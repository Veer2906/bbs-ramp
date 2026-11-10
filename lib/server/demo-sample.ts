import "server-only";
import { DEMO_PROMPT } from "../demo-scenario";
import type { DocStatus, DocType, FinancialDocument, Issue, LineItem, MemoryNode, Run, RunEvent, Settings } from "../types";
import type { Backend } from "./db/backend";

/*
  Sample results for showing the app without a live run: the October close as a finished
  chat, with the documents, matches and issues the sandbox portals contain (see docs/DEMO.md).
  Everything here uses fixed ids prefixed "sample", so loading twice replaces rather than
  duplicates, and nothing a real run produced is touched.
*/

const RUN_ID = "run_sample_october_close";
const NW = "Northwind Office Supply";
const CF = "Contoso Freight Lines";
const AC = "Acme Industrial Parts";

const PORTAL: Record<string, { url: string; address: string[] }> = {
  [NW]: { url: "http://127.0.0.1:8080/northwind/", address: ["4100 Industrial Pkwy", "Elk Grove Village, IL 60007"] },
  [CF]: { url: "http://127.0.0.1:8080/contoso/", address: ["88 Terminal Rd", "Joliet, IL 60436"] },
  [AC]: { url: "http://127.0.0.1:8080/acme/", address: [] },
};

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const docId = (number: string) => `doc_sample_${number.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
const li = (description: string, quantity: number, unit_price: number): LineItem => ({ description, quantity, unit_price, amount: Math.round(quantity * unit_price * 100) / 100 });

interface Spec {
  type: DocType;
  vendor: string;
  number: string;
  date: string;
  amount: number;
  po?: string;
  ref?: string;
  ledger?: string;
  status: DocStatus;
  confidence?: FinancialDocument["matchConfidence"];
  lines?: LineItem[];
  notes?: string;
}

const DOCS: Spec[] = [
  // Northwind: six invoices across two history pages, and the monthly statement.
  { type: "invoice", vendor: NW, number: "INV-10471", date: "2026-10-03", amount: 643.18, po: "PO-5521", ledger: "L-1001", status: "approved", confidence: "exact", lines: [li("Copy paper, 10 ream case", 6, 52.1), li("Toner HP 58A", 3, 109.99), li("Shipping", 1, 0.61)] },
  { type: "invoice", vendor: NW, number: "INV-10482", date: "2026-10-09", amount: 1248.5, po: "PO-5534", ledger: "L-1002", status: "needs_review", confidence: "probable", lines: [li("Office chair, task", 5, 229.7), li("Chair mats", 1, 100)], notes: "Invoice total is $36.00 below the ledger amount for the same PO." },
  { type: "invoice", vendor: NW, number: "INV-10490", date: "2026-10-17", amount: 389, po: "PO-5540", ledger: "L-1003", status: "matched", confidence: "exact", lines: [li("Shredder, cross-cut", 1, 389)] },
  { type: "invoice", vendor: NW, number: "INV-10493", date: "2026-10-20", amount: 512.6, po: "PO-5544", status: "needs_review", lines: [li("Break room supplies", 1, 512.6)], notes: "No October ledger transaction carries this PO or amount." },
  { type: "invoice", vendor: NW, number: "INV-10497", date: "2026-10-24", amount: 2115.75, po: "PO-5549", ledger: "L-1004", status: "matched", confidence: "exact", lines: [li("Laptop docking station", 9, 235.08), li("Shipping", 1, 0.03)] },
  { type: "invoice", vendor: NW, number: "INV-10501", date: "2026-10-28", amount: 190, po: "PO-5558", ledger: "L-1011", status: "needs_review", confidence: "probable", lines: [li("Desk organizer", 6, 30)], notes: "Line items total $180.00; the invoice bills $190.00 with no tax or freight line." },
  { type: "statement", vendor: NW, number: "ST-NW-202610", date: "2026-10-30", amount: 2818.35, status: "extracted", notes: "Open invoices on the statement: INV-10493, INV-10497 and INV-10501. A summary, not an additional purchase." },

  // Contoso: freight bills, the purchase orders behind them, and proof of delivery.
  { type: "invoice", vendor: CF, number: "FB-77120", date: "2026-10-06", amount: 1870, po: "PO-5528", ref: "BOL 4419003", ledger: "L-1005", status: "approved", confidence: "exact", lines: [li("FTL freight, Chicago, IL to Atlanta, GA", 1, 1870)] },
  { type: "invoice", vendor: CF, number: "FB-77141", date: "2026-10-14", amount: 945.3, po: "PO-5536", ref: "BOL 4419051", ledger: "L-1006", status: "needs_review", confidence: "uncertain", lines: [li("LTL freight, Chicago, IL to St. Louis, MO", 1, 945.3)], notes: "The bill prints PO-5536. The ledger line and the delivery record both say PO-5537." },
  { type: "purchase_order", vendor: CF, number: "PO-5528", date: "2026-10-01", amount: 1870, po: "PO-5528", ledger: "L-1005", status: "matched", confidence: "exact", lines: [li("FTL freight, 1 trailer", 1, 1870)] },
  { type: "purchase_order", vendor: CF, number: "PO-5537", date: "2026-10-09", amount: 945.3, po: "PO-5537", ledger: "L-1006", status: "matched", confidence: "exact", lines: [li("LTL freight, 3 pallets", 1, 945.3)] },
  { type: "purchase_order", vendor: CF, number: "PO-5552", date: "2026-10-25", amount: 1210, po: "PO-5552", ledger: "L-1007", status: "matched", confidence: "exact", lines: [li("LTL freight, 4 pallets", 1, 1210)], notes: "Authorizes the shipment. No freight bill has been issued for it yet." },
  { type: "other", vendor: CF, number: "POD-4419003", date: "2026-10-07", amount: 0, po: "PO-5528", ref: "FB-77120", ledger: "L-1005", status: "matched", confidence: "exact", notes: "Proof of delivery, Atlanta, GA. Signed by M. Lewis." },
  { type: "other", vendor: CF, number: "POD-4419051", date: "2026-10-15", amount: 0, po: "PO-5537", ref: "FB-77141", ledger: "L-1006", status: "matched", confidence: "exact", notes: "Proof of delivery, St. Louis, MO. Signed by R. Chen." },

  // Acme: invoices, receipts and a credit memo, all printable pages.
  { type: "invoice", vendor: AC, number: "AC-INV-2291", date: "2026-10-02", amount: 3480, po: "PO-5519", ledger: "L-1008", status: "approved", confidence: "exact", lines: [li("Hydraulic fitting kit", 12, 165), li("Hose assembly 3/8in", 30, 50)] },
  { type: "invoice", vendor: AC, number: "AC-INV-2307", date: "2026-10-15", amount: 760.4, po: "PO-5538", ledger: "L-1009", status: "matched", confidence: "exact", lines: [li("Bearing 6204-2RS", 80, 6.38), li("Shaft collar 1in", 40, 6.25)] },
  { type: "invoice", vendor: AC, number: "AC-INV-2315", date: "2026-10-21", amount: 1125, po: "PO-5546", ledger: "L-1010", status: "needs_review", confidence: "exact", lines: [li("Pneumatic cylinder 2in bore", 5, 225)], notes: "Paid $600.00 and credited $125.00. $400.00 is still outstanding." },
  { type: "invoice", vendor: AC, number: "AC-INV-2320", date: "2026-10-28", amount: 420, ledger: "L-1012", status: "matched", confidence: "probable", lines: [li("Maintenance kit", 1, 420)], notes: "No PO or warehouse on the invoice. Allocated to the Chicago accrual on your instruction." },
  { type: "receipt", vendor: AC, number: "RC-8812", date: "2026-10-04", amount: 3480, ref: "ACH-760110", ledger: "L-1008", status: "matched", confidence: "exact", notes: "Payment for AC-INV-2291." },
  { type: "receipt", vendor: AC, number: "RC-8840", date: "2026-10-16", amount: 760.4, ref: "ACH-761204", ledger: "L-1009", status: "matched", confidence: "exact", notes: "Payment for AC-INV-2307." },
  { type: "receipt", vendor: AC, number: "RC-8841", date: "2026-10-16", amount: 760.4, ref: "ACH-761204", status: "needs_review", notes: "Reissued copy of RC-8840 with the same bank reference. No additional funds received." },
  { type: "receipt", vendor: AC, number: "RC-8850", date: "2026-10-25", amount: 600, ref: "ACH-762508", ledger: "L-1010", status: "matched", confidence: "exact", notes: "Partial remittance against AC-INV-2315." },
  { type: "credit_memo", vendor: AC, number: "CM-0124", date: "2026-10-26", amount: 125, ref: "AC-INV-2315", ledger: "L-1010", status: "matched", confidence: "exact", notes: "Return allowance for a damaged cylinder. Reduces the invoice balance by $125.00." },
];

const d = (number: string) => `[${number}](doc:${docId(number)})`;
const l = (id: string) => `[${id}](ledger:${id})`;

const ISSUES: (Pick<Issue, "kind" | "severity" | "title" | "detail" | "ledgerId"> & { key: string; docs: string[] })[] = [
  { key: "bank", kind: "other", severity: "high", title: "Acme asks us to change its remittance bank", detail: "The Acme portal shows a notice dated 09/01/2026 asking for vendor master records to be updated. Bank changes stay on hold until finance verifies them through an established contact. Nothing was changed.", docs: [] },
  { key: "mismatch", kind: "amount_mismatch", severity: "high", title: "INV-10482 is $36.00 below the ledger", detail: `${d("INV-10482")} totals $1,248.50. ${l("L-1002")} records $1,284.50 for the same PO-5534. The two middle digits look transposed.`, ledgerId: "L-1002", docs: ["INV-10482"] },
  { key: "duplicate", kind: "duplicate", severity: "medium", title: "RC-8841 repeats a payment already counted", detail: `${d("RC-8841")} and ${d("RC-8840")} both carry bank reference ACH-761204 for $760.40. The later one says it is a reissued copy, so the payment is counted once.`, ledgerId: "L-1009", docs: ["RC-8840", "RC-8841"] },
  { key: "arithmetic", kind: "amount_mismatch", severity: "medium", title: "INV-10501 bills $190.00 for $180.00 of goods", detail: `${d("INV-10501")} lists six desk organizers at $30.00 each. No tax or freight line explains the extra $10.00. ${l("L-1011")} carries the billed $190.00.`, ledgerId: "L-1011", docs: ["INV-10501"] },
  { key: "unrecorded", kind: "unrecorded", severity: "medium", title: "INV-10493 is not in the ledger", detail: `${d("INV-10493")} for $512.60 (PO-5544, break room supplies) has no October ledger transaction. It also appears as open on statement ${d("ST-NW-202610")}.`, docs: ["INV-10493", "ST-NW-202610"] },
  { key: "po", kind: "ambiguous", severity: "medium", title: "FB-77141 prints a different PO than the ledger", detail: `${d("FB-77141")} prints PO-5536. ${l("L-1006")} and delivery record ${d("POD-4419051")} both say PO-5537, and the amount agrees at $945.30. Matched as uncertain.`, ledgerId: "L-1006", docs: ["FB-77141", "POD-4419051", "PO-5537"] },
  { key: "partial", kind: "other", severity: "medium", title: "AC-INV-2315 still has $400.00 outstanding", detail: `${d("AC-INV-2315")} is $1,125.00. ${d("RC-8850")} pays $600.00 and ${d("CM-0124")} credits $125.00. A partial payment is not a settled invoice.`, ledgerId: "L-1010", docs: ["AC-INV-2315", "RC-8850", "CM-0124"] },
  { key: "freight", kind: "missing_document", severity: "medium", title: "No freight bill for the 4-pallet shipment", detail: `${l("L-1007")} records $1,210.00 against PO-5552. ${d("PO-5552")} authorizes it, but Contoso has not issued a freight bill.`, ledgerId: "L-1007", docs: ["PO-5552"] },
  { key: "joliet", kind: "missing_document", severity: "low", title: "Joliet maintenance accrual has no document", detail: `${l("L-1013")} accrues $420.00 for a Joliet maintenance kit. The only Acme invoice for that amount was allocated to Chicago.`, ledgerId: "L-1013", docs: [] },
];

const LEARNED: Pick<MemoryNode, "id" | "kind" | "title" | "detail" | "links">[] = [
  { id: "mem_sample_reissue", kind: "vendor", title: "Acme reissued receipts", detail: "Acme sometimes issues a second receipt for one payment. Compare the ACH reference before counting a receipt as new money.", links: ["mem_acme", "mem_ap"] },
  { id: "mem_sample_contoso_po", kind: "vendor", title: "Contoso PO numbers", detail: "A freight bill can print a neighbouring PO number. Confirm the PO against the delivery record before matching.", links: ["mem_contoso", "mem_evidence"] },
];

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const TITLE: Record<DocType, string> = { invoice: "Invoice", purchase_order: "Purchase order", receipt: "Payment receipt", credit_memo: "Credit memo", statement: "Statement", other: "Proof of delivery" };

/** A plain print view of the document, stored as its original file. */
function printView(doc: FinancialDocument): string {
  const from = doc.type === "purchase_order" ? "Brightline Building Supply Co." : doc.vendor;
  const address = doc.type === "purchase_order" ? ["1200 W Lake St, Suite 400", "Chicago, IL 60607"] : PORTAL[doc.vendor].address;
  const meta: [string, string | undefined][] = [["Number", doc.number], ["Date", doc.date], ["PO", doc.poNumber], ["Reference", doc.reference]];
  const rows = doc.lineItems
    .map((i) => `<tr><td>${esc(i.description)}</td><td class="r">${i.quantity ?? ""}</td><td class="r">${i.unit_price !== undefined ? usd(i.unit_price) : ""}</td><td class="r">${usd(i.amount ?? 0)}</td></tr>`)
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(doc.number)}</title><style>
body{font:13px/1.55 Georgia,"Times New Roman",serif;color:#16150f;margin:40px 44px;background:#fff}
h1{font-size:13px;letter-spacing:.14em;text-transform:uppercase;margin:0 0 2px}h2{font-size:26px;font-weight:normal;margin:0}
.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #16150f;padding-bottom:16px}
.muted{color:#6b675c}dl{display:grid;grid-template-columns:auto auto;gap:2px 18px;margin:0;text-align:right}dt{color:#6b675c}dd{margin:0}
table{width:100%;border-collapse:collapse;margin-top:26px}th{text-align:left;font-weight:normal;color:#6b675c;border-bottom:1px solid #c9c5b8;padding:6px 0}
td{padding:7px 0;border-bottom:1px solid #eceadf}.r{text-align:right}.total{display:flex;justify-content:flex-end;gap:40px;margin-top:18px;font-size:17px}
.note{margin-top:26px;padding:12px 14px;background:#f5f3ea}.foot{margin-top:40px;font-size:11px;color:#8a8679}
</style></head><body>
<div class="top"><div><h1>${esc(from)}</h1>${address.map((a) => `<div class="muted">${esc(a)}</div>`).join("")}</div>
<div><h2>${TITLE[doc.type]}</h2><dl>${meta.filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v!)}</dd>`).join("")}</dl></div></div>
<p class="muted" style="margin-top:22px">${doc.type === "purchase_order" ? "Vendor" : "Bill to"}</p>
<div>${doc.type === "purchase_order" ? esc(doc.vendor) : "Accounts Payable, Brightline Building Supply Co.<br>1200 W Lake St, Suite 400, Chicago, IL 60607"}</div>
${rows ? `<table><tr><th>Description</th><th class="r">Qty</th><th class="r">Unit</th><th class="r">Amount</th></tr>${rows}</table>` : ""}
${doc.amount ? `<div class="total"><span class="muted">${doc.type === "credit_memo" ? "Credit" : doc.type === "receipt" ? "Received" : doc.type === "statement" ? "Open balance" : "Total"}</span><b>${usd(doc.amount)}</b></div>` : ""}
${doc.notes && doc.type !== "invoice" ? `<div class="note">${esc(doc.notes)}</div>` : ""}
<div class="foot">Sample document from the ${esc(doc.vendor)} sandbox portal.</div>
</body></html>`;
}

function build(now: number, settings: Partial<Settings> | undefined) {
  const start = now - 19 * 60_000;
  let t = start;
  let n = 0;
  const events: RunEvent[] = [];
  const push = (e: Record<string, unknown>, seconds = 2) => {
    t += seconds * 1000;
    events.push({ ...e, id: ++n, t } as RunEvent);
  };
  const act = (tool: string, label: string, seconds = 2) => push({ kind: "action", tool, label, ok: true, ms: Math.round(seconds * 620) }, seconds);
  const note = (text: string) => push({ kind: "note", text }, 3);

  const documents: FinancialDocument[] = [];
  const byNumber = new Map<string, FinancialDocument>();
  const record = (number: string) => {
    const s = DOCS.find((x) => x.number === number)!;
    const doc: FinancialDocument = {
      id: docId(s.number), runId: RUN_ID, type: s.type, vendor: s.vendor, number: s.number, date: s.date,
      amount: s.type === "other" ? undefined : s.amount, currency: "USD", poNumber: s.po, reference: s.ref, lineItems: s.lines ?? [],
      sourceUrl: PORTAL[s.vendor].url, fileName: `${s.number}.html`, status: s.status, ledgerId: s.ledger, matchConfidence: s.confidence, notes: s.notes, createdAt: t,
    };
    documents.push(doc);
    byNumber.set(number, doc);
    act("download_url", `Download ${s.number}.pdf`, 3);
    act("read_document", `Read ${s.number}.pdf`, 4);
    doc.createdAt = t;
    push({ kind: "document", documentId: doc.id, label: `${TITLE[s.type]} ${s.number}, ${usd(s.amount)}` }, 1);
    if (s.ledger) push({ kind: "match", documentId: doc.id, ledgerId: s.ledger, label: `${s.number} matched to ${s.ledger}${s.status === "needs_review" ? ", needs review" : ""}` }, 1);
  };

  const issues: Issue[] = [];
  const flag = (key: string) => {
    const s = ISSUES.find((x) => x.key === key)!;
    const issue: Issue = { id: `iss_sample_${key}`, runId: RUN_ID, kind: s.kind, severity: s.severity, title: s.title, detail: s.detail, ledgerId: s.ledgerId, documentIds: s.docs.map(docId), status: "open", createdAt: t };
    issues.push(issue);
    push({ kind: "issue", issueId: issue.id, label: s.title, severity: s.severity }, 2);
  };
  const signIn = (vendor: string, host: string) => {
    act("goto", `Open 127.0.0.1:8080/${host}/`, 3);
    act("fill_credential", `Enter username for ${vendor} from the vault`);
    act("fill_credential", `Enter password for ${vendor} from the vault`);
    act("press", "Press Enter", 3);
  };

  push({ kind: "user", text: DEMO_PROMPT }, 0);
  note("I'll take the three portals in turn, then reconcile everything against the 13 October ledger lines.");
  act("get_ledger", "Check ledger", 2);

  signIn(NW, "northwind");
  act("click", "Click #8", 2);
  for (const x of ["INV-10471", "INV-10482", "INV-10490"]) record(x);
  flag("mismatch");
  act("click", "Click #21", 3);
  for (const x of ["INV-10493", "INV-10497", "INV-10501"]) record(x);
  flag("unrecorded");
  flag("arithmetic");
  act("click", "Click #5", 2);
  record("ST-NW-202610");
  note("Northwind is done: six invoices over two pages and the statement. The statement's $2,818.35 open balance equals the three unpaid invoices, so it adds no new purchases.");

  signIn(CF, "contoso");
  act("type", 'Type "10/01/2026"');
  act("type", 'Type "10/31/2026"');
  act("click", "Click #12", 3);
  for (const x of ["FB-77120", "FB-77141"]) record(x);
  act("click", "Click #4", 2);
  for (const x of ["PO-5528", "PO-5537", "PO-5552"]) record(x);
  act("click", "Click #6", 2);
  for (const x of ["POD-4419003", "POD-4419051"]) record(x);
  flag("po");
  flag("freight");

  signIn(AC, "acme");
  note("Acme opens with a notice asking us to change its remittance bank. The saved rule keeps bank changes on hold, so I'm recording the notice for review and changing nothing.");
  flag("bank");
  act("click", "Click #3", 2);
  for (const x of ["AC-INV-2291", "AC-INV-2307", "AC-INV-2315"]) record(x);
  act("click", "Click #9", 2);
  for (const x of ["RC-8812", "RC-8840", "RC-8841", "RC-8850"]) record(x);
  flag("duplicate");
  act("click", "Click #11", 2);
  record("CM-0124");
  flag("partial");
  push(
    {
      kind: "question", qid: "q_sample_warehouse", options: ["Chicago", "Joliet", "Leave it unallocated"], answer: "Chicago",
      text: `AC-INV-2320 is a $420.00 maintenance kit with no PO or warehouse. It fits both the Chicago accrual ${l("L-1012")} and the Joliet accrual ${l("L-1013")}. Which warehouse received it?`,
    },
    4
  );
  record("AC-INV-2320");
  flag("joliet");

  push(
    {
      kind: "summary",
      text: [
        `**Retrieved** 23 October documents from Northwind, Contoso and Acme: 12 invoices and freight bills, 3 purchase orders, 2 delivery records, 4 receipts, a credit memo and a statement. Every original is saved.`,
        `**Matched** 12 of 13 ledger lines. Six agree exactly, for example ${d("INV-10471")} to ${l("L-1001")} and ${d("FB-77120")} to ${l("L-1005")}.`,
        `**Needs your review**`,
        `- ${d("INV-10482")} is $1,248.50 against ${l("L-1002")} at $1,284.50, a $36.00 difference.`,
        `- ${d("INV-10501")} bills $190.00 for line items that total $180.00.`,
        `- ${d("INV-10493")} for $512.60 has no ledger transaction.`,
        `- ${d("FB-77141")} prints PO-5536; the ledger and ${d("POD-4419051")} say PO-5537.`,
        `- ${l("L-1007")} has ${d("PO-5552")} but no freight bill yet.`,
        `- ${d("RC-8841")} is a reissued copy of ${d("RC-8840")}. One payment, counted once.`,
        `- ${d("AC-INV-2315")} has $400.00 outstanding after ${d("RC-8850")} and ${d("CM-0124")}.`,
        `- ${l("L-1013")}, the Joliet accrual, has no document now that ${d("AC-INV-2320")} is allocated to Chicago.`,
        `**Decision for you** Acme's portal asks for a change of remittance bank. I recorded the notice and left payment details alone.`,
        `**Outstanding** Northwind $2,818.35 per ${d("ST-NW-202610")}, and Acme $400.00 on ${d("AC-INV-2315")} plus $420.00 on ${d("AC-INV-2320")}. Approvals and payment changes are yours.`,
      ].join("\n\n").replace(/\n\n- /g, "\n- "),
    },
    6
  );

  const provider = settings?.provider ?? "openai";
  const model = (provider === "anthropic" ? settings?.anthropicModel : provider === "bedrock" ? settings?.bedrockModel : settings?.openaiModel) ?? "gpt-5.4-mini";
  const run: Run = {
    id: RUN_ID, title: "Can you do the October close for Brightline?", instruction: DEMO_PROMPT, status: "done", provider, model,
    createdAt: start, updatedAt: t, events, plan: [], usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, costUsd: 0, turns: 0 },
    browser: { url: PORTAL[AC].url, title: AC },
  };
  return { run, documents, issues, finishedAt: t };
}

/** Load (or reload) the sample close. Real documents, issues, runs and edited memory are left alone. */
export async function seedSample(b: Backend) {
  const { run, documents, issues, finishedAt } = build(Date.now(), await b.getState<Partial<Settings>>("settings"));

  const existingDocs = new Set((await b.documents()).map((x) => x.id));
  for (const doc of documents) {
    if (existingDocs.has(doc.id)) await b.deleteDocument(doc.id);
    await b.putFile(`${doc.id}.html`, Buffer.from(printView(doc), "utf8"), "text/html; charset=utf-8");
    await b.insertDocument(doc);
  }
  const existingIssues = new Set((await b.issues()).map((x) => x.id));
  for (const issue of issues) {
    if (existingIssues.has(issue.id)) await b.updateIssue(issue.id, issue);
    else await b.insertIssue(issue);
  }
  await b.saveRun(run);

  const memory = (await b.getState<MemoryNode[]>("memory")) ?? [];
  const known = new Set(memory.map((m) => m.id));
  const learned = LEARNED.filter((m) => !known.has(m.id)).map((m) => ({ ...m, links: m.links.filter((id) => known.has(id)), source: "agent" as const, createdAt: finishedAt, updatedAt: finishedAt }));
  if (learned.length) await b.setState("memory", [...memory, ...learned]);

  return { documents: documents.length, issues: issues.length };
}
