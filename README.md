# Financial document retrieval agent

Give it an instruction like *"Retrieve every October invoice from all vendor portals and reconcile them against the ledger"*. It signs in to legacy vendor portals in a real browser, finds the transactions, downloads invoices, purchase orders and receipts, reads them, matches them to ledger entries, and flags anything a person should check.

## Setup

You need Node.js 22 or newer, a [Sail Research](https://docs.sailresearch.com) API key, and either an Anthropic API key or AWS Bedrock access.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your local config and add your keys:

   ```bash
   cp .env.example .env.local
   ```

   | Variable | Required | What it is |
   | --- | --- | --- |
   | `SAIL_API_KEY` | yes | Runs the agent's browser on a Sailbox (a persistent cloud computer) |
   | `ANTHROPIC_API_KEY` | one of these | Claude through the Anthropic API |
   | `AWS_BEARER_TOKEN_BEDROCK` or `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` | one of these | Claude through AWS Bedrock; also set `AWS_REGION` |
   | `VAULT_KEY` | recommended | Encrypts saved portal passwords. Any long random string, e.g. `openssl rand -hex 32` |
   | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | optional | Store everything in Supabase instead of `.data/` (see below) |

3. Start the app:

   ```bash
   npm run dev
   ```

   Open http://localhost:3000. It opens straight into the agent.

4. Pick the model provider in **Settings** (Anthropic or Bedrock) and try a suggestion, e.g. *"Retrieve every October 2026 invoice from all vendor portals and reconcile them against the ledger"*.

The first task provisions the Sailbox and installs Chromium in it, which takes about a minute. After that the box is reused: logins, cookies and downloads persist between tasks.

Production build: `npm run build && npm start`.

## What's in the app

- **New task / task view**: instruction box, live timeline of what the agent is doing, live browser view, plan, cost. You can send guidance while it works, answer its questions, or stop it.
- **Documents**: every retrieved document with extracted fields, the original file, and approve/reject.
- **Reconciliation**: ledger transactions with their supporting documents, coverage, and documents that have no ledger entry. Import your own ledger as CSV (`date,vendor,description,amount,po,reference`).
- **Issues**: amount mismatches, missing documents, duplicates, unrecorded invoices, access problems. Resolve them or send the agent to investigate.
- **Vault**: saved logins for vendor portals. Passwords are encrypted (AES-256-GCM) before they are stored and are never shown again, to you or the agent. When the agent reaches a login it has no password for, the task pauses and shows a Vault form; save the login and it carries on, or skip that portal.
- **Memory**: active memory the agent reads before every task: key dates, important invoices, vendor quirks and your rules, shown as a graph and a list. Add, edit, link or delete any fact; the agent also saves facts it learns (marked *Learned*) with its `remember` tool.
- **Settings**: Anthropic API or AWS Bedrock, model choice, vendor portals, storage status, Sailbox status, reset.

## Demo portals

The Sailbox also runs three deliberately old-fashioned vendor portals on `127.0.0.1:8080` so the agent has something realistic to work against out of the box:

| Portal | Style | Login |
| --- | --- | --- |
| Northwind Office Supply | Table layout, paginated invoice list, PDF downloads | `apclerk` / `Northwind#2004` |
| Contoso Freight Lines | Frameset, CGI search, freight bills and POs | `CF-88213` / PIN `4417` |
| Acme Industrial Parts | ASP.NET postbacks, notice to acknowledge, print views | `bbs_ap` / `acme-ap-77` |

The seeded data includes exact matches, an invoice that is $36 under the ledger, an invoice missing from the ledger, a ledger entry with no freight bill, and a duplicated payment receipt. Replace the portals in Settings with real ones.

## Storage: Supabase or local files

Without Supabase settings everything is kept in `.data/` on this machine. To use Supabase, add to `.env.local`:

```bash
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...   # server only, never sent to the browser
SUPABASE_DB_URL=postgresql://...  # optional: lets the app create its tables on start
```

If you skip `SUPABASE_DB_URL`, paste `supabase/migrations/*.sql` into the Supabase SQL editor once. Documents, ledger, issues, task history, settings, memory and Vault entries go into tables; original files go into a private `documents` Storage bucket. The app shows a banner if Supabase is set but not ready.

Vault encryption key: set `VAULT_KEY` (keep it somewhere safe). Without it the app creates `.data/vault.key`; if that file is lost, saved passwords can't be decrypted and must be re-entered.

## Layout

- `sailbox/` runs inside the Sailbox: `browserd.py` (persistent Playwright browser behind a small HTTP API), `portals.py` (demo portals), `bootstrap.sh` (idempotent setup).
- `lib/server/` runs in Next.js: Sail client, workspace manager, agent loop and tools, Anthropic/Bedrock clients, Vault (`vault.ts`, `crypto.ts`), storage backends (`db/local.ts`, `db/supabase.ts`).
- `app/api/` route handlers; `components/` UI.

Design decisions and their reasoning are in [docs/DESIGN.md](docs/DESIGN.md).
