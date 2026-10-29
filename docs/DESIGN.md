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

## Credentials never reach the model
Portal passwords are stored server-side and are write-only in the UI. The model calls `fill_credential(portal_id, field, ref)` and the server types the value, so secrets never appear in prompts, logs or run history.

## Matching and validation are code, judgement is the model's
The model extracts fields from the actual document (`read_document` gives PDF text, or an image for scans) and decides which ledger entry a document supports. Deterministic checks run in code when it records or matches: duplicate document numbers, line items not summing to the total, invoice total vs ledger amount, PO mismatch, and two invoices on one ledger entry. Those create issues automatically, so the model doesn't need to remember to.

## Human in the loop
The agent asks (`ask_human`) only when it is blocked: unknown credentials, MFA codes, or a truly ambiguous instruction. Everything else becomes an issue so the run keeps going. Users can also send guidance mid-run; it's injected into the next model turn. Documents can be approved or rejected and issues resolved, or handed back to the agent with "Investigate".

## Storage
A JSON file store under `.data/` (documents, issues, ledger, settings, runs) plus the original files in `.data/files/`. It keeps `npm run dev` a one-command setup. The store is behind one module (`lib/server/store.ts`) so swapping in a database later touches one file.

## One run at a time
There is one browser, so one active run. Starting another while one is running returns 409 and the UI says so.
