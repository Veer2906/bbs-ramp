# Design log

## Browser runs in a Sailbox, driven through `exec`
Sailboxes are persistent VMs with a filesystem that survives sleep ([docs](https://docs.sailresearch.com)). The agent needs a browser whose cookies and downloads survive between tasks, so Chromium runs there under a persistent Playwright profile (`/data/profile`). A small daemon (`sailbox/browserd.py`) keeps the browser alive and accepts one JSON action at a time on `127.0.0.1:7777`; the Next server reaches it with Sail's `exec` API (`ctl.py` + base64 payload). This avoids exposing a public port and needs no ingress setup. Measured overhead per action is roughly 250 ms.

The server talks to Sail over raw HTTP (`lib/server/sail.ts`) instead of `@sailresearch/sdk` because the SDK requires Node 22+ and the HTTP API is small (create, get, resume, exec, files).

The runtime files are hashed; when they change the server re-uploads them and re-runs `bootstrap.sh`, so updating the browser code needs no manual step. The Sailbox id is stored in `.data/sailbox.json` and reused; a terminated box is replaced automatically.

## Text snapshots with element refs, screenshots on demand
Each browser action returns a compact text snapshot of the page (all frames, including framesets) where interactive elements are numbered `[12 link "PDF"]`. The model acts on refs, which is far cheaper and faster than vision on every step and works well on table-heavy legacy pages. A `screenshot` tool exists for pages the text can't describe. Screenshots are still captured on every step for the live view in the UI, but are not sent to the model.

## Speed
- Several tool calls per turn; only the last browser action in a turn returns a snapshot.
- `download_url` fetches document links with the browser's cookies instead of clicking through viewers.
- Only the latest few page snapshots and the latest screenshot stay in context; older ones are replaced with a one-line stub.
- Prompt caching on the system prompt, tools and the moving tail of the conversation. In testing, about 80% of input tokens were cache reads.
- The Sailbox is warmed when the New task screen opens.
- A full three-portal October reconciliation took 47 model turns and cost about $0.04 on Claude Haiku 5.5.

## Models: Anthropic API or Bedrock
Both go through the Anthropic TypeScript SDK's Messages interface: `@anthropic-ai/sdk` for the API and `@anthropic-ai/bedrock-sdk` for Bedrock (bearer token `AWS_BEARER_TOKEN_BEDROCK` or the standard AWS credential chain). Inference-profile ids such as `global.anthropic.claude-sonnet-4-6` use the InvokeModel client; plain `anthropic.claude-*` ids use the Claude-in-Bedrock (Mantle) client. The model is chosen in Settings; any id can be typed in.

## Credentials never reach the model: the Vault
Logins live in the Vault, not in Settings. Each password is encrypted with AES-256-GCM (Node `crypto`, random 12-byte IV, entry id bound as additional authenticated data so ciphertext can't be swapped between entries). The key comes from `VAULT_KEY` or a generated `.data/vault.key` (mode 0600), and is never stored next to the ciphertext, so a leaked database alone doesn't reveal passwords. The UI is write-only: the API returns only `hasPassword`.

The model sees Vault entries as id, name, URL and username. It calls `fill_credential(vault_id, field, ref)`; the server decrypts and types the value into the Sailbox browser, so secrets never appear in prompts, tool results, logs or run history. When there's no matching entry, or the saved one is rejected, the model calls `request_credentials`; the run pauses and the timeline shows a Vault form. `ask_human` is explicitly not for passwords, and page observations flag password fields with no saved login so the model asks proactively. Skipping a login lets the run continue with other portals and records an access issue.

## Matching and validation are code, judgement is the model's
The model extracts fields from the actual document (`read_document` gives PDF text, or an image for scans) and decides which ledger entry a document supports. Deterministic checks run in code when it records or matches: duplicate document numbers, line items not summing to the total, invoice total vs ledger amount, PO mismatch, and two invoices on one ledger entry. Those create issues automatically, so the model doesn't need to remember to.

## Human in the loop
The agent asks (`ask_human`) only when it is blocked: MFA codes, or a truly ambiguous instruction. Everything else becomes an issue so the run keeps going. Users can also send guidance mid-run; it's injected into the next model turn. Documents can be approved or rejected and issues resolved, or handed back to the agent with "Investigate".

## Storage: Supabase, with local files as fallback
All persistence goes through one `Backend` interface (`lib/server/db/backend.ts`) with two implementations. `local.ts` keeps JSON files under `.data/`, so `npm run dev` works with no setup. `supabase.ts` is used when `SUPABASE_URL` and a service-role key are set: one table per collection (`ledger_entries`, `documents`, `issues`, `runs`, `vault_entries`, plus `app_state` for settings), and original files in a private `documents` Storage bucket. Rows keep the domain fields as columns so the data is readable in the Supabase table editor and queryable with SQL.

Access is server-only with the service-role key; RLS is enabled with no policies, so the anon key can read nothing. The schema is a plain migration (`supabase/migrations/`); if `SUPABASE_DB_URL` is set the app applies it on start (idempotent `create ... if not exists`), otherwise the storage banner says what to run. Run saves are serialized per run so a slow older write can't overwrite a newer one.

## One run at a time
There is one browser, so one active run. Starting another while one is running returns 409 and the UI says so.
