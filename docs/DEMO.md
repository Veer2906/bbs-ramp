# October 2026 close demo

Start a new chat and type or paste the starting prompt below. The model chooses its plan, navigation, extraction, matches, questions and summary. Nothing is seeded on its own: no recorded run, no fabricated documents, no scripted tool sequence. The one exception is opt-in: **Settings → Load sample results** adds a finished sample close (`lib/server/demo-sample.ts`) for showing the app when a live run isn't possible. Its ids start with `sample`, and **Reset workspace** removes its documents, issues and chat (the two facts it adds to Memory stay until you delete them).

The inputs are three sandbox portals, 13 October ledger rows, encrypted logins and 10 linked finance facts. Original documents are served by the real HTTP portals in the Sailbox. The agent must retrieve them before they appear in Documents and Supabase Storage. Fixtures use a fixed October 30, 2026 date so relative date filters continue to work later.

## Prepare or repeat

- Existing workspaces receive a versioned repair even if the old `seeded` flag is already true. Normal loads do not recreate logins you delete after that repair.
- **Settings → Restore demo data** repairs sandbox logins, inserts missing sample ledger rows, restores the sample finance facts and updates the Sailbox runtime. Custom portals, custom logins, edited ledger rows, documents, issues and task history remain.
- **Settings → Reset workspace** starts a clean demo: it deletes documents, issues, files and run history, replaces the ledger with the fixture, and restores demo logins and facts. Its confirmation describes those changes.
- Choose a configured model provider. Sail and that provider need credentials; Supabase and `VAULT_KEY` are required.
- Logins and ledger inputs are shared in `sailbox/demo.json`. Portal documents live in `sailbox/portals.py`. Both runtime files are hashed and uploaded when they change. Each portal has its own session cookie.

## Starting prompt

> Can you do the October close for Brightline? Go through Northwind, Contoso and Acme, pull everything for the month, match it to the ledger and flag whatever looks off. At the end, tell me what I need to decide.

The prompt is short on purpose. The ten saved finance facts carry the detail: the close period, what counts as supporting evidence, how to treat payments and credits, the hold on bank changes, and the instruction to ask before choosing a warehouse. If you delete those facts, the same prompt gives the agent much less to go on.

## Evidence to discover

These are fixture expectations for checking the demo, not instructions sent to the model. Counts and wording of issues can vary with the model's investigation.

| Evidence | Feature exercised |
| --- | --- |
| Northwind has six October invoices across two history pages; older months remain as distractors | Pagination, date scope, PDF downloads |
| INV-10471, INV-10490 and INV-10497 agree with their ledger entries | Exact matching, line items, original-file preview |
| INV-10482 is $1,248.50 against ledger L-1002's $1,284.50 | $36 amount mismatch |
| INV-10493 is $512.60 with no ledger transaction | Unrecorded purchase |
| INV-10501 claims $190 but six $30 organizers sum to $180 | Arithmetic validation and investigation |
| ST-NW-202610 lists $2,818.35 in open invoices | Statement reconciliation without double counting |
| Contoso has two October freight bills, three POs and two delivery PDFs | Frames, date entry, POST downloads, supporting and “other” documents |
| FB-77141 prints PO-5536 while the ledger and delivery record say PO-5537 | Conflicting references and uncertain matching |
| PO-5552 exists for L-1007, but there is no freight bill | Missing invoice despite supporting PO |
| Acme has four October invoices, four receipts and one credit memo | Notices, WebForms postbacks, pagination, HTML-to-PDF |
| RC-8840 and RC-8841 reference the same ACH payment; the latter says it is a reissue | Duplicate receipt analysis |
| AC-INV-2315 is $1,125; RC-8850 pays $600; CM-0124 credits $125 | Partial payment and $400 remaining balance |
| AC-INV-2320 has no warehouse or PO; two $420 ledger accruals are possible | Human question, linked memory rules, ambiguous match |
| Acme's notice requests a bank change; the saved rule requires independent verification | Supplier notice review and durable memory |

There are 23 October source documents: six Northwind invoices and a statement; two Contoso bills, three POs and two delivery records; four Acme invoices, four receipts and a credit. Additional older documents allow scope filtering. The agent may also preserve the bank notice as evidence.

When asked about the maintenance kit, choose **Chicago** or **Joliet**, or ask the agent to leave the allocation unresolved. This is a real decision in the mock scenario; there is no hidden “correct” warehouse.

## Other interactions to show

| Feature | How to exercise it |
| --- | --- |
| Live plan, browser, timeline, usage | Watch the close run; expand the browser and tool steps |
| Mid-run guidance | Send “Check the delivery record before deciding which PO is correct” |
| Secure credential request and resume | After seeding, delete one sandbox login, start that vendor's task, and enter its documented demo credentials in the form |
| Skip/access issue | In that credential form choose “Skip this portal”; restore demo data before the next normal run |
| Stop and continue | Stop a task, then send a follow-up in the same chat |
| Approve/reject and originals | Open a retrieved document, inspect its PDF, then approve an exact match or reject a duplicate |
| Issue investigation and resolution | Select an issue, use Investigate, and resolve it after reviewing the evidence |
| Memory graph and editing | Select a connected fact, edit a rule, then start a follow-up task |
| Persistence | Reload the app or connect another server to the same Supabase project and `VAULT_KEY` |
| Focused scenarios | Ask for one vendor at a time, for example "Can you close out Acme for October?" or "Did we double pay Acme for anything in October?" |

These user interactions and model/provider selection are available during the demo; a starting prompt cannot perform human approvals, click UI controls, or guarantee which questions a model asks.

## Verification

`npm run test:demo` checks seed repair/retries, encrypted credentials, custom-data preservation, each HTTP login, session isolation, form submissions, pagination, document downloads and the intentional fixture discrepancies. `npm run lint` and `npx tsc --noEmit` check the app changes.
