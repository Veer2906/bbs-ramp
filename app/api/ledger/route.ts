import { body, fail, json } from "@/lib/server/http";
import { dataChanged } from "@/lib/server/runs";
import { store } from "@/lib/server/store";
import type { LedgerEntry } from "@/lib/types";

// Accepts JSON entries or CSV text with headers date,vendor,description,amount[,po,reference].
export async function PUT(req: Request) {
  const input = await body<{ entries: Partial<LedgerEntry>[]; csv: string }>(req);
  let rows: Partial<LedgerEntry>[] = input.entries ?? [];
  if (input.csv) {
    const lines = input.csv.trim().split(/\r?\n/).filter(Boolean);
    const head = splitCsv(lines.shift() ?? "").map((h) => h.toLowerCase().replace(/[^a-z]/g, ""));
    const col = (names: string[]) => head.findIndex((h) => names.includes(h));
    const c = {
      date: col(["date", "posted", "postingdate"]),
      vendor: col(["vendor", "supplier", "payee"]),
      description: col(["description", "memo", "item"]),
      amount: col(["amount", "total", "value"]),
      po: col(["po", "ponumber", "purchaseorder"]),
      ref: col(["reference", "ref", "invoice", "invoicenumber"]),
    };
    if (c.date < 0 || c.vendor < 0 || c.amount < 0) return fail("CSV needs date, vendor and amount columns");
    rows = lines.map((l) => {
      const v = splitCsv(l);
      return {
        date: v[c.date],
        vendor: v[c.vendor],
        description: c.description >= 0 ? v[c.description] : "",
        amount: Number(String(v[c.amount]).replace(/[$,\s]/g, "")),
        poNumber: c.po >= 0 ? v[c.po] || undefined : undefined,
        reference: c.ref >= 0 ? v[c.ref] || undefined : undefined,
      };
    });
  }
  const entries: LedgerEntry[] = rows
    .filter((r) => r.date && r.vendor && Number.isFinite(Number(r.amount)))
    .map((r, i) => ({
      id: r.id || `L-${String(i + 1).padStart(3, "0")}`,
      date: String(r.date),
      vendor: String(r.vendor),
      description: String(r.description ?? ""),
      amount: Number(r.amount),
      poNumber: r.poNumber || undefined,
      reference: r.reference || undefined,
    }));
  if (!entries.length) return fail("No valid ledger rows");
  store.saveLedger(entries);
  dataChanged();
  return json(entries);
}

function splitCsv(line: string) {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}
