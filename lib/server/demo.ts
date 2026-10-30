import type { LedgerEntry, Portal } from "../types";

export interface DemoLogin {
  portalId: string;
  username: string;
  password: string;
}

// The three sandbox vendors are served from inside the Sailbox (sailbox/portals.py).
export const DEMO_PORTALS: Portal[] = [
  {
    id: "northwind",
    name: "Northwind Office Supply",
    url: "http://127.0.0.1:8080/northwind/",
    notes: "Office supplies. Customer extranet; invoices as PDF.",
  },
  {
    id: "contoso",
    name: "Contoso Freight Lines",
    url: "http://127.0.0.1:8080/contoso/",
    notes: "Freight carrier. The login is an account number and a PIN.",
  },
  {
    id: "acme",
    name: "Acme Industrial Parts",
    url: "http://127.0.0.1:8080/acme/",
    notes: "Industrial parts. Invoices, payment receipts and credit memos.",
  },
];

// Seeded into the vault (encrypted) on first start so the demo runs unattended.
export const DEMO_LOGINS: DemoLogin[] = [
  { portalId: "northwind", username: "apclerk", password: "Northwind#2004" },
  { portalId: "contoso", username: "CF-88213", password: "4417" },
  { portalId: "acme", username: "bbs_ap", password: "acme-ap-77" },
];

export const DEMO_LEDGER: LedgerEntry[] = [
  { id: "L-1001", date: "2026-10-03", vendor: "Northwind Office Supply", description: "Copy paper and toner", amount: 643.18, poNumber: "PO-5521" },
  { id: "L-1002", date: "2026-10-09", vendor: "Northwind Office Supply", description: "Task chairs (5) and chair mat", amount: 1284.5, poNumber: "PO-5534" },
  { id: "L-1003", date: "2026-10-17", vendor: "Northwind Office Supply", description: "Cross-cut shredder", amount: 389.0, poNumber: "PO-5540" },
  { id: "L-1004", date: "2026-10-24", vendor: "Northwind Office Supply", description: "Laptop docking stations (9)", amount: 2115.75, poNumber: "PO-5549" },
  { id: "L-1005", date: "2026-10-06", vendor: "Contoso Freight Lines", description: "Freight, FTL to Atlanta", amount: 1870.0, poNumber: "PO-5528" },
  { id: "L-1006", date: "2026-10-14", vendor: "Contoso Freight Lines", description: "Freight, LTL to St. Louis", amount: 945.3, poNumber: "PO-5537" },
  { id: "L-1007", date: "2026-10-27", vendor: "Contoso Freight Lines", description: "Freight, LTL 4 pallets", amount: 1210.0, poNumber: "PO-5552" },
  { id: "L-1008", date: "2026-10-02", vendor: "Acme Industrial Parts", description: "Hydraulic fittings and hoses", amount: 3480.0, poNumber: "PO-5519" },
  { id: "L-1009", date: "2026-10-15", vendor: "Acme Industrial Parts", description: "Bearings and shaft collars", amount: 760.4, poNumber: "PO-5538" },
  { id: "L-1010", date: "2026-10-21", vendor: "Acme Industrial Parts", description: "Pneumatic cylinders", amount: 1125.0, poNumber: "PO-5546" },
];
