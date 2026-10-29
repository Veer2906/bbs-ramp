# Financial document retrieval agent

Give it an instruction like *"Retrieve every October invoice from all vendor portals and reconcile them against the ledger"*. It signs in to legacy vendor portals in a real browser, finds the transactions, downloads invoices, purchase orders and receipts, reads them, matches them to ledger entries, and flags anything a person should check.

## Run it

```bash
cp .env.example .env.local   # add SAIL_API_KEY and ANTHROPIC_API_KEY (or Bedrock credentials)
npm install
npm run dev                  # http://localhost:3000
```

The first task provisions a Sailbox (a persistent cloud computer) and installs Chromium in it, which takes about a minute. After that the box is reused: logins, cookies and downloads persist between tasks.

## What's in the app

- **New task / task view**: instruction box, live timeline of what the agent is doing, live browser view, plan, cost. You can send guidance while it works, answer its questions, or stop it.
- **Documents**: every retrieved document with extracted fields, the original file, and approve/reject.
- **Reconciliation**: ledger transactions with their supporting documents, coverage, and documents that have no ledger entry. Import your own ledger as CSV (`date,vendor,description,amount,po,reference`).
- **Issues**: amount mismatches, missing documents, duplicates, unrecorded invoices, access problems. Resolve them or send the agent to investigate.
- **Settings**: Anthropic API or AWS Bedrock, model choice, vendor portal credentials (write-only; the agent types them without seeing them), Sailbox status, reset.

## Demo portals

The Sailbox also runs three deliberately old-fashioned vendor portals on `127.0.0.1:8080` so the agent has something realistic to work against out of the box:

| Portal | Style | Login |
| --- | --- | --- |
| Northwind Office Supply | Table layout, paginated invoice list, PDF downloads | `apclerk` / `Northwind#2004` |
| Contoso Freight Lines | Frameset, CGI search, freight bills and POs | `CF-88213` / PIN `4417` |
| Acme Industrial Parts | ASP.NET postbacks, notice to acknowledge, print views | `bbs_ap` / `acme-ap-77` |

The seeded data includes exact matches, an invoice that is $36 under the ledger, an invoice missing from the ledger, a ledger entry with no freight bill, and a duplicated payment receipt. Replace the portals in Settings with real ones.

## Layout

- `sailbox/` runs inside the Sailbox: `browserd.py` (persistent Playwright browser behind a small HTTP API), `portals.py` (demo portals), `bootstrap.sh` (idempotent setup).
- `lib/server/` runs in Next.js: Sail client, workspace manager, agent loop and tools, Anthropic/Bedrock clients, JSON file store.
- `app/api/` route handlers; `components/` UI.

Design decisions and their reasoning are in [docs/DESIGN.md](docs/DESIGN.md).
