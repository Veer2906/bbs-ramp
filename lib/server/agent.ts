import "server-only";
import fs from "node:fs";
import path from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import type { FinancialDocument, Issue, LedgerEntry, Run, Settings } from "../types";
import { addUsage, llmFor } from "./llm";
import { dataChanged, emit, persist, pushFrame, pushRun, runs, updateEvent, type Live } from "./runs";
import { id, store } from "./store";
import { BROWSER_TOOLS, TOOLS } from "./tools";
import { browser, ensureWorkspace, readBoxFile, workspaceStatus, type BrowserReply } from "./workspace";

type Block = Anthropic.ContentBlockParam;
type ToolResult = Anthropic.ToolResultBlockParam;
type Msg = Anthropic.MessageParam;

const MAX_TURNS = 90;
const KEEP_SNAPSHOTS = 4;
const KEEP_IMAGES = 1;

export function startRun(instruction: string): Run {
  if (runs.active()) throw new Error("Another run is in progress. Stop it or wait for it to finish.");
  const settings = store.settings();
  const { model, provider } = describeModel(settings);
  const run: Run = {
    id: id("run"),
    title: titleFrom(instruction),
    instruction,
    status: "starting",
    provider,
    model,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    events: [],
    plan: [],
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, costUsd: 0, turns: 0 },
  };
  const l = runs.register(run);
  emit(l, { kind: "user", text: instruction });
  persist(l, true);
  void execute(l, settings).catch((e) => fail(l, e));
  return run;
}

function describeModel(s: Settings) {
  return s.provider === "bedrock"
    ? { provider: "bedrock" as const, model: s.bedrockModel }
    : { provider: "anthropic" as const, model: s.anthropicModel };
}

function titleFrom(text: string) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > 64 ? `${t.slice(0, 61).replace(/\s+\S*$/, "")}...` : t;
}

export function sendMessage(runId: string, text: string) {
  const l = runs.get(runId);
  if (!l) throw new Error("Run is not active");
  emit(l, { kind: "user", text });
  if (l.question) {
    const q = l.question;
    l.question = undefined;
    q.resolve(text);
  } else {
    l.inbox.push(text);
  }
}

export function stopRun(runId: string) {
  const l = runs.get(runId);
  if (!l) return;
  l.abort.abort();
  if (l.question) {
    const q = l.question;
    l.question = undefined;
    q.resolve("");
  }
}

function fail(l: Live, e: unknown) {
  if (l.abort.signal.aborted) {
    l.run.status = "stopped";
    emit(l, { kind: "status", text: "Stopped" });
  } else {
    l.run.status = "failed";
    emit(l, { kind: "error", text: errorText(e) });
  }
  pushRun(l);
  persist(l, true);
}

function errorText(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (/credit balance is too low/i.test(msg)) return "The Anthropic account is out of credit. Switch to Bedrock in settings.";
  if (/401|authentication|invalid x-api-key/i.test(msg)) return `The model provider rejected the credentials: ${msg.slice(0, 200)}`;
  return msg.slice(0, 600);
}

function systemPrompt(settings: Settings) {
  const today = new Date().toISOString().slice(0, 10);
  const portals = settings.portals
    .map((p) => `- ${p.name} (portal_id: ${p.id})\n  URL: ${p.url}\n  Username: ${p.username || "(none)"}${p.notes ? `\n  Notes: ${p.notes}` : ""}`)
    .join("\n");
  return `You are an accounts payable agent. You operate a persistent cloud computer with a real Chromium browser to retrieve financial documents from legacy vendor portals, extract their data, match them to the company ledger, and flag problems for the finance team.

Today is ${today}.

Vendor portals (log in with fill_credential; never ask the user for a stored password):
${portals || "(none configured)"}

How you work
- Start by calling update_plan with a short plan, then act immediately. Keep the plan current as steps finish.
- Be fast. Each tool call costs seconds. Chain several actions in one turn when you already know the refs, e.g. fill username, fill password with submit=true. Only the last browser action in a turn returns a page snapshot.
- Page snapshots list interactive elements as [ref kind "label"]; use those refs. Refs expire when the page changes.
- Legacy portals are clunky: framesets, postback links, notices to acknowledge, pagination, popups, PDFs that open in new tabs. Read the snapshot carefully, look for document lists, and page through results until the requested date range is covered.
- When a document link's href is visible, prefer download_url over clicking. If a document is only a printable HTML page, use save_page_as_pdf.
- The browser profile persists across runs, so you may already be logged in.

For every relevant document
1. Download it, then read_document to read the actual file.
2. record_document with values taken from the document itself (number, dates as YYYY-MM-DD, total, PO number, line items). Use the document type the file says it is.
3. Call get_ledger (once per vendor is enough) and match_document to the ledger transaction it supports. Use "exact" when amount and PO/reference agree, "probable" when the evidence is strong but not complete, "uncertain" otherwise.
4. flag_issue for anything finance must review:
   - amount_mismatch: document total differs from the ledger amount (match_document flags this automatically, so do not repeat it)
   - missing_document: a ledger transaction in scope has no supporting document in the portal
   - unrecorded: a document has no ledger transaction
   - duplicate: the same document appears twice or two documents bill the same thing
   - ambiguous: several ledger entries could match
   - access: you cannot log in or reach a page
Do not stop to ask about findings; flag them and continue. Use ask_human only when you are truly blocked (unknown credentials, MFA code, an instruction that can be read two very different ways).

Scope: retrieve what the instruction asks for. If it is vague ("get last month's invoices"), choose the sensible interpretation, state it in one line, and proceed. When the task covers ledger transactions, check every one in scope for supporting documents.

Communication: before a group of tool calls write at most one short sentence. Finish with the finish tool: a brief summary with counts (retrieved, matched, issues) and what needs human attention. Do not use markdown headings.`;
}

async function execute(l: Live, settings: Settings) {
  const { client, model } = llmFor(settings);
  const signal = l.abort.signal;
  l.run.status = "running";
  pushRun(l);

  if (workspaceStatus().state !== "ready") {
    const ev = emit(l, { kind: "status", text: "Connecting to the cloud computer" });
    const timer = setInterval(() => {
      const s = workspaceStatus();
      if (s.message && ev.kind === "status" && ev.text !== s.message) {
        ev.text = s.message;
        updateEvent(l, ev);
      }
    }, 1000);
    try {
      await ensureWorkspace();
    } finally {
      clearInterval(timer);
    }
  }

  const system: Anthropic.TextBlockParam[] = [{ type: "text", text: systemPrompt(settings), cache_control: { type: "ephemeral" } }];
  const tools = TOOLS.map((t, i) => (i === TOOLS.length - 1 ? { ...t, cache_control: { type: "ephemeral" as const } } : t));
  const messages: Msg[] = [{ role: "user", content: [{ type: "text", text: l.run.instruction }] }];
  let nudged = false;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    if (signal.aborted) throw new Error("stopped");
    drainInbox(l, messages);
    const resp = await client.messages.create(
      { model, max_tokens: 4096, system, tools, messages: prepare(messages) },
      { signal }
    );
    addUsage(l.run.usage, model, resp.usage);
    pushRun(l);
    messages.push({ role: "assistant", content: resp.content as Block[] });

    for (const b of resp.content) if (b.type === "text" && b.text.trim()) emit(l, { kind: "note", text: b.text.trim() });

    const uses = resp.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (!uses.length) {
      if (resp.stop_reason === "max_tokens" || !nudged) {
        nudged = true;
        messages.push({ role: "user", content: [{ type: "text", text: "Continue. Call finish when the task is complete." }] });
        continue;
      }
      return complete(l, textOf(resp.content) || "Done.");
    }

    const lastBrowser = uses.map((u) => BROWSER_TOOLS.has(u.name)).lastIndexOf(true);
    const results: ToolResult[] = [];
    let finished: string | undefined;
    for (let i = 0; i < uses.length; i++) {
      const u = uses[i];
      if (signal.aborted) throw new Error("stopped");
      if (finished !== undefined) {
        results.push({ type: "tool_result", tool_use_id: u.id, content: "skipped: task already finished" });
        continue;
      }
      const input = (u.input ?? {}) as Record<string, unknown>;
      if (u.name === "finish") {
        finished = String(input.summary ?? "");
        results.push({ type: "tool_result", tool_use_id: u.id, content: "ok" });
        continue;
      }
      const t0 = Date.now();
      const ev = emit(l, { kind: "action", tool: u.name, label: labelFor(u.name, input, settings) });
      try {
        const out = await runTool(l, settings, u.name, input, i === lastBrowser || !BROWSER_TOOLS.has(u.name));
        if (ev.kind === "action") {
          ev.ok = !out.isError;
          ev.ms = Date.now() - t0;
          if (out.detail) ev.detail = out.detail;
          updateEvent(l, ev);
        }
        results.push({ type: "tool_result", tool_use_id: u.id, content: out.content, ...(out.isError ? { is_error: true } : {}) });
      } catch (e) {
        if (signal.aborted) throw e;
        const msg = errorText(e);
        if (ev.kind === "action") {
          ev.ok = false;
          ev.ms = Date.now() - t0;
          ev.detail = msg;
          updateEvent(l, ev);
        }
        results.push({ type: "tool_result", tool_use_id: u.id, content: `Error: ${msg}`, is_error: true });
      }
    }
    messages.push({ role: "user", content: results });
    if (finished !== undefined) return complete(l, finished);
  }
  complete(l, "Stopped after reaching the step limit. Review the retrieved documents and open issues.");
}

function complete(l: Live, summary: string) {
  l.run.plan = l.run.plan.map((s) => (s.status === "skipped" ? s : { ...s, status: "done" }));
  emit(l, { kind: "summary", text: summary });
  l.run.status = "done";
  pushRun(l);
  persist(l, true);
}

function textOf(content: Anthropic.ContentBlock[]) {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

function drainInbox(l: Live, messages: Msg[]) {
  if (!l.inbox.length) return;
  const text = l.inbox.splice(0).map((t) => `Message from the user while you work: ${t}`).join("\n");
  const last = messages[messages.length - 1];
  if (last.role === "user" && Array.isArray(last.content)) last.content.push({ type: "text", text });
  else messages.push({ role: "user", content: [{ type: "text", text }] });
}

// Old page snapshots and screenshots are the bulk of the context; keep only the latest few.
function prepare(messages: Msg[]): Msg[] {
  let snaps = 0;
  let images = 0;
  const out: Msg[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user" || !Array.isArray(m.content)) {
      out.unshift(m);
      continue;
    }
    const content = m.content.map((b) => {
      if (b.type !== "tool_result" || !Array.isArray(b.content)) return b;
      const parts = b.content.map((c) => {
        if (c.type === "image") return ++images > KEEP_IMAGES ? { type: "text" as const, text: "[earlier screenshot removed]" } : c;
        if (c.type === "text" && c.text.startsWith("URL: ") && c.text.length > 600) {
          if (++snaps > KEEP_SNAPSHOTS) return { type: "text" as const, text: `${c.text.split("\n")[0]}\n[earlier page snapshot removed]` };
        }
        return c;
      });
      return { ...b, content: parts };
    });
    out.unshift({ ...m, content } as Msg);
  }
  const last = out[out.length - 1];
  if (Array.isArray(last.content) && last.content.length) {
    const blocks = [...last.content];
    blocks[blocks.length - 1] = { ...blocks[blocks.length - 1], cache_control: { type: "ephemeral" } } as Block;
    out[out.length - 1] = { ...last, content: blocks } as Msg;
  }
  return out;
}

function labelFor(name: string, a: Record<string, unknown>, settings: Settings): string {
  const s = (v: unknown) => String(v ?? "");
  switch (name) {
    case "update_plan":
      return "Updated plan";
    case "goto":
      return `Open ${s(a.url).replace(/^https?:\/\//, "")}`;
    case "click":
      return `Click #${s(a.ref)}`;
    case "type":
      return `Type "${s(a.text).slice(0, 40)}"`;
    case "fill_credential": {
      const p = settings.portals.find((x) => x.id === a.portal_id);
      return `Enter ${s(a.field)} for ${p?.name ?? s(a.portal_id)}`;
    }
    case "select":
      return `Select "${s(a.option)}"`;
    case "check":
      return a.checked === false ? `Untick #${s(a.ref)}` : `Tick #${s(a.ref)}`;
    case "press":
      return `Press ${s(a.key)}`;
    case "scroll":
      return `Scroll ${s(a.direction)}`;
    case "back":
      return "Go back";
    case "switch_tab":
      return `Switch to tab ${s(a.index)}`;
    case "wait":
      return `Wait ${s(a.seconds)}s`;
    case "screenshot":
      return "Look at the page";
    case "download_url":
      return `Download ${s(a.filename) || s(a.url).split("/").pop()}`;
    case "save_page_as_pdf":
      return `Save page as ${s(a.filename)}`;
    case "read_document":
      return `Read ${s(a.file)}`;
    case "list_files":
      return "List downloaded files";
    case "record_document":
      return `Record ${s(a.type).replace("_", " ")} ${s(a.number)}`;
    case "get_ledger":
      return `Check ledger${a.vendor ? ` for ${s(a.vendor)}` : ""}`;
    case "match_document":
      return `Match ${s(a.document_id)} to ${s(a.ledger_id)}`;
    case "flag_issue":
      return `Flag: ${s(a.title)}`;
    case "ask_human":
      return "Ask you";
    default:
      return name;
  }
}

interface ToolOut {
  content: ToolResult["content"];
  isError?: boolean;
  detail?: string;
}

const text = (t: string, isError = false): ToolOut => ({ content: [{ type: "text", text: t }], isError });

function describePage(r: BrowserReply): string {
  const lines = [`URL: ${r.url ?? ""}`];
  if (r.title) lines.push(`Title: ${r.title}`);
  if (r.tabs && r.tabs.length > 1) lines.push(`Tabs: ${r.tabs.map((t, i) => `${i}: ${t}`).join("  ")}`);
  if (r.downloads?.length) lines.push(`Downloads: ${r.downloads.map((d) => `${d.name} (${d.size} bytes)`).join(", ")}`);
  if (r.text) lines.push("", r.text);
  return lines.join("\n");
}

async function browse(l: Live, action: Record<string, unknown>, observe: boolean): Promise<ToolOut> {
  const r = await browser({ ...action, observe, shot: observe }, 60);
  if (r.shot && r.url) pushFrame(l, { image: r.shot, url: r.url, title: r.title ?? "" });
  if (!r.ok) {
    const base = `Error: ${r.error ?? "browser action failed"}`;
    return text(r.text ? `${base}\n\n${describePage(r)}` : base, true);
  }
  if (!observe) {
    const dl = r.downloads?.length ? ` Downloads: ${r.downloads.map((d) => d.name).join(", ")}` : "";
    return text(`ok.${dl}`);
  }
  return { content: [{ type: "text", text: describePage(r) }], detail: r.downloads?.length ? r.downloads.map((d) => d.name).join(", ") : undefined };
}

async function runTool(l: Live, settings: Settings, name: string, a: Record<string, unknown>, observe: boolean): Promise<ToolOut> {
  switch (name) {
    case "update_plan": {
      const steps = Array.isArray(a.steps) ? a.steps : [];
      l.run.plan = steps.map((s: { title?: unknown; status?: unknown }) => ({
        title: String(s.title ?? ""),
        status: (["pending", "active", "done", "skipped"].includes(String(s.status)) ? s.status : "pending") as Run["plan"][number]["status"],
      }));
      pushRun(l);
      return text("Plan saved.");
    }
    case "goto":
      return browse(l, { action: "goto", url: a.url }, observe);
    case "click":
      return browse(l, { action: "click", ref: a.ref }, observe);
    case "type":
      return browse(l, { action: "type", ref: a.ref, text: a.text, submit: a.submit }, observe);
    case "fill_credential": {
      const p = settings.portals.find((x) => x.id === a.portal_id);
      if (!p) return text(`Unknown portal_id ${String(a.portal_id)}`, true);
      const value = a.field === "password" ? p.password : p.username;
      if (!value) return text(`No ${String(a.field)} stored for ${p.name}. Ask the user to add it in settings.`, true);
      return browse(l, { action: "type", ref: a.ref, text: value, submit: a.submit }, observe);
    }
    case "select":
      return browse(l, { action: "select", ref: a.ref, value: a.option }, observe);
    case "check":
      return browse(l, { action: "check", ref: a.ref, checked: a.checked ?? true }, observe);
    case "press":
      return browse(l, { action: "press", key: a.key }, observe);
    case "scroll":
      return browse(l, { action: "scroll", direction: a.direction }, observe);
    case "back":
      return browse(l, { action: "back" }, observe);
    case "switch_tab":
      return browse(l, { action: "tab", index: a.index }, observe);
    case "wait":
      return browse(l, { action: "wait", seconds: a.seconds }, observe);
    case "screenshot": {
      const r = await browser({ action: "screenshot" });
      if (!r.ok || !r.image) return text(`Error: ${r.error ?? "no screenshot"}`, true);
      pushFrame(l, { image: r.image, url: r.url ?? "", title: r.title ?? "" });
      return {
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: r.image } },
          { type: "text", text: describePage(r) },
        ],
      };
    }
    case "download_url":
    case "save_page_as_pdf": {
      const r = await browser(
        name === "download_url"
          ? { action: "fetch", url: a.url, filename: a.filename, observe: false }
          : { action: "save_pdf", filename: a.filename, observe: false }
      );
      if (!r.ok) return text(`Error: ${r.error}`, true);
      const d = r.downloads?.[0] as (BrowserReply["downloads"] & object)[number] & { status?: number; type?: string };
      if (!d) return text("Nothing was saved.", true);
      if (d.type?.includes("text/html") && !/\.html?$/i.test(d.name))
        return text(`The server returned an HTML page, not a document (saved as ${d.name}). The link probably needs a click or form submit; open the page and use the button, or save_page_as_pdf.`, true);
      if (d.status && d.status >= 400) return text(`The server answered HTTP ${d.status}; saved ${d.name} anyway (${d.size} bytes). It is probably an error page.`, true);
      return { content: [{ type: "text", text: `Saved ${d.name} (${d.size} bytes)` }], detail: d.name };
    }
    case "read_document": {
      const r = await browser({ action: "read_file", path: a.file, max_chars: 12000 });
      if (!r.ok || r.error) return text(`Error: ${r.error}`, true);
      const parts: Exclude<ToolResult["content"], string | undefined> = [];
      if (typeof r.image === "string") {
        parts.push({ type: "image", source: { type: "base64", media_type: (r.media_type as "image/png") ?? "image/png", data: r.image } });
      }
      parts.push({ type: "text", text: `${r.name}${r.pages ? ` (${r.pages} pages)` : ""}${r.note ? `\n${r.note}` : ""}\n\n${r.text || "(no text)"}` });
      return { content: parts };
    }
    case "list_files": {
      const r = await browser({ action: "list_files" });
      const files = r.files ?? [];
      return text(files.length ? files.map((f) => `${f.name} (${f.size} bytes)`).join("\n") : "No files yet.");
    }
    case "record_document":
      return recordDocument(l, a);
    case "get_ledger":
      return text(ledgerView(a));
    case "match_document":
      return matchDocument(l, a);
    case "flag_issue": {
      const issue = addIssue(l, {
        kind: a.kind as Issue["kind"],
        severity: (a.severity as Issue["severity"]) ?? "medium",
        title: String(a.title ?? ""),
        detail: String(a.detail ?? ""),
        ledgerId: a.ledger_id ? String(a.ledger_id) : undefined,
        documentIds: Array.isArray(a.document_ids) ? a.document_ids.map(String) : [],
      });
      return text(issue.existed ? `Already flagged as ${issue.id}; not added again.` : `Issue ${issue.id} recorded.`);
    }
    case "ask_human":
      return askHuman(l, String(a.question ?? ""), Array.isArray(a.options) ? a.options.map(String) : []);
    default:
      return text(`Unknown tool ${name}`, true);
  }
}

const norm = (s: string | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const vendorKey = (s: string) => norm(s).replace(/(inc|llc|ltd|co|corp|company|lines|supply|parts)$/g, "").slice(0, 8);

async function recordDocument(l: Live, a: Record<string, unknown>): Promise<ToolOut> {
  const fileName = String(a.file ?? "");
  const vendor = String(a.vendor ?? "").trim();
  const number = String(a.number ?? "").trim();
  const type = a.type as FinancialDocument["type"];
  const docs = store.documents();
  const dup = docs.find((d) => d.type === type && norm(d.number) === norm(number) && vendorKey(d.vendor) === vendorKey(vendor));
  if (dup) {
    return text(
      `Already in the repository as ${dup.id} (${dup.type} ${dup.number}, ${dup.amount ?? "?"}, status ${dup.status}${dup.ledgerId ? `, matched to ${dup.ledgerId}` : ""}). Not recorded again. If the portal genuinely lists it twice, flag a duplicate.`
    );
  }
  const doc: FinancialDocument = {
    id: id("doc"),
    runId: l.run.id,
    type,
    vendor,
    number,
    date: a.date ? String(a.date) : undefined,
    dueDate: a.due_date ? String(a.due_date) : undefined,
    amount: typeof a.amount === "number" ? a.amount : Number(a.amount) || undefined,
    currency: String(a.currency ?? "USD"),
    poNumber: a.po_number ? String(a.po_number) : undefined,
    reference: a.reference ? String(a.reference) : undefined,
    lineItems: Array.isArray(a.line_items) ? (a.line_items as FinancialDocument["lineItems"]) : [],
    sourceUrl: a.source_url ? String(a.source_url) : l.run.browser?.url,
    fileName,
    sailPath: fileName ? `/data/files/${path.basename(fileName)}` : undefined,
    status: "extracted",
    notes: a.notes ? String(a.notes) : undefined,
    createdAt: Date.now(),
  };
  const warnings: string[] = [];
  if (doc.sailPath) {
    try {
      const buf = await readBoxFile(doc.sailPath);
      fs.writeFileSync(path.join(store.filesDir(), `${doc.id}${path.extname(fileName) || ".bin"}`), buf);
    } catch (e) {
      warnings.push(`could not copy the file to the repository (${errorText(e).slice(0, 120)})`);
      doc.fileName = undefined;
    }
  }
  const lineSum = doc.lineItems.reduce((s, li) => s + (li.amount ?? (li.quantity ?? 0) * (li.unit_price ?? 0)), 0);
  if (doc.lineItems.length && doc.amount !== undefined && Math.abs(lineSum - doc.amount) > 0.01) {
    warnings.push(`line items sum to ${lineSum.toFixed(2)} but the total is ${doc.amount.toFixed(2)}; check for tax, freight or a misread total`);
  }
  store.saveDocuments([...docs, doc]);
  emit(l, { kind: "document", documentId: doc.id, label: `${typeLabel(doc.type)} ${doc.number} · ${doc.vendor}${doc.amount !== undefined ? ` · ${money(doc.amount)}` : ""}` });
  dataChanged(l);
  const hint = suggestLedger(doc);
  return text(`Recorded as ${doc.id}.${warnings.length ? ` Warning: ${warnings.join("; ")}.` : ""}${hint ? `\n${hint}` : ""}`);
}

function suggestLedger(doc: FinancialDocument) {
  if (doc.type === "purchase_order") return "";
  const ledger = store.ledger().filter((e) => vendorKey(e.vendor) === vendorKey(doc.vendor));
  const hits = ledger.filter(
    (e) =>
      (doc.poNumber && norm(e.poNumber) === norm(doc.poNumber)) ||
      norm(e.reference) === norm(doc.number) ||
      (doc.amount !== undefined && Math.abs(e.amount - doc.amount) < 0.01)
  );
  if (!hits.length) return ledger.length ? "No ledger entry shares its PO, number or amount." : "No ledger entries for this vendor.";
  return `Likely ledger candidates: ${hits.map((e) => `${e.id} (${e.date}, ${money(e.amount)}${e.poNumber ? `, ${e.poNumber}` : ""}${e.reference ? `, ref ${e.reference}` : ""})`).join("; ")}`;
}

function ledgerView(a: Record<string, unknown>) {
  const docs = store.documents();
  const vk = a.vendor ? vendorKey(String(a.vendor)) : "";
  const entries = store
    .ledger()
    .filter((e) => !vk || vendorKey(e.vendor).startsWith(vk) || vk.startsWith(vendorKey(e.vendor)))
    .filter((e) => (!a.from || e.date >= String(a.from)) && (!a.to || e.date <= String(a.to)));
  if (!entries.length) return "No ledger entries match.";
  return entries
    .map((e) => {
      const linked = docs.filter((d) => d.ledgerId === e.id).map((d) => `${typeLabel(d.type)} ${d.number}`);
      return `${e.id} | ${e.date} | ${e.vendor} | ${money(e.amount)} | ${e.description}${e.poNumber ? ` | ${e.poNumber}` : ""}${e.reference ? ` | ref ${e.reference}` : ""} | ${linked.length ? `linked: ${linked.join(", ")}` : "no documents"}`;
    })
    .join("\n");
}

function matchDocument(l: Live, a: Record<string, unknown>): ToolOut {
  const docs = store.documents();
  const doc = docs.find((d) => d.id === a.document_id);
  const entry = store.ledger().find((e) => e.id === a.ledger_id);
  if (!doc) return text(`Unknown document_id ${String(a.document_id)}`, true);
  if (!entry) return text(`Unknown ledger_id ${String(a.ledger_id)}`, true);
  const confidence = (a.confidence as FinancialDocument["matchConfidence"]) ?? "probable";
  const notes: string[] = [];
  let status: FinancialDocument["status"] = confidence === "exact" ? "matched" : "needs_review";

  const supporting = doc.type === "purchase_order" || doc.type === "receipt" || doc.type === "credit_memo";
  const others = docs.filter((d) => d.id !== doc.id && d.ledgerId === entry.id && d.type === doc.type && !supporting);
  if (others.length) {
    status = "needs_review";
    const issue = addIssue(l, {
      kind: "duplicate",
      severity: "high",
      title: `${entry.id} already has ${typeLabel(doc.type).toLowerCase()} ${others.map((o) => o.number).join(", ")}`,
      detail: `${typeLabel(doc.type)} ${doc.number} (${money(doc.amount)}) was matched to the same ledger transaction as ${others
        .map((o) => `${o.number} (${money(o.amount)})`)
        .join(", ")}. This may be a duplicate bill.`,
      ledgerId: entry.id,
      documentIds: [doc.id, ...others.map((o) => o.id)],
    });
    notes.push(`possible duplicate, issue ${issue.id}`);
  }
  if (doc.type === "invoice" && doc.amount !== undefined && Math.abs(doc.amount - entry.amount) > 0.01) {
    status = "needs_review";
    const diff = doc.amount - entry.amount;
    const issue = addIssue(l, {
      kind: "amount_mismatch",
      severity: Math.abs(diff) > 100 || Math.abs(diff) / entry.amount > 0.02 ? "high" : "medium",
      title: `${doc.vendor} ${doc.number} is ${money(Math.abs(diff))} ${diff > 0 ? "over" : "under"} the ledger`,
      detail: `Invoice total ${money(doc.amount)} vs ledger ${entry.id} ${money(entry.amount)} (${entry.description}).`,
      ledgerId: entry.id,
      documentIds: [doc.id],
    });
    notes.push(`amount differs by ${money(diff)}, issue ${issue.id}`);
  }
  if (doc.poNumber && entry.poNumber && norm(doc.poNumber) !== norm(entry.poNumber)) {
    status = "needs_review";
    notes.push(`PO ${doc.poNumber} differs from ledger ${entry.poNumber}`);
  }
  const note = [a.note ? String(a.note) : "", ...notes].filter(Boolean).join("; ") || undefined;
  store.updateDocument(doc.id, { ledgerId: entry.id, matchConfidence: confidence, status, notes: [doc.notes, note].filter(Boolean).join("; ") || undefined });
  emit(l, {
    kind: "match",
    documentId: doc.id,
    ledgerId: entry.id,
    label: `${typeLabel(doc.type)} ${doc.number} → ${entry.description} ${money(entry.amount)}${status === "matched" ? "" : " · review"}`,
  });
  dataChanged(l);
  return text(`Matched ${doc.id} to ${entry.id} (${status}).${notes.length ? ` ${notes.join("; ")}.` : ""}`);
}

function addIssue(l: Live, i: Omit<Issue, "id" | "runId" | "status" | "createdAt">): Issue & { existed?: boolean } {
  const same = store
    .issues()
    .find(
      (x) =>
        x.status === "open" &&
        x.kind === i.kind &&
        ((i.ledgerId && x.ledgerId === i.ledgerId) || (i.documentIds.length && i.documentIds.every((d) => x.documentIds.includes(d))))
    );
  if (same) return { ...same, existed: true };
  const issue: Issue = { ...i, id: id("iss"), runId: l.run.id, status: "open", createdAt: Date.now() };
  store.saveIssues([...store.issues(), issue]);
  for (const d of issue.documentIds) {
    const doc = store.documents().find((x) => x.id === d);
    if (doc && doc.status !== "approved" && doc.status !== "rejected") store.updateDocument(d, { status: "needs_review" });
  }
  emit(l, { kind: "issue", issueId: issue.id, label: issue.title, severity: issue.severity });
  dataChanged(l);
  return issue;
}

async function askHuman(l: Live, question: string, options: string[]): Promise<ToolOut> {
  const qid = id("q");
  const ev = emit(l, { kind: "question", qid, text: question, options });
  l.run.status = "waiting";
  pushRun(l);
  persist(l, true);
  const answer = await new Promise<string>((resolve) => {
    l.question = { qid, resolve };
  });
  if (ev.kind === "question") {
    ev.answer = answer;
    updateEvent(l, ev);
  }
  if (l.abort.signal.aborted) throw new Error("stopped");
  l.run.status = "running";
  pushRun(l);
  return text(answer ? `The user answered: ${answer}` : "The user did not answer. Use your best judgement and note the assumption.");
}

const typeLabel = (t: FinancialDocument["type"]) =>
  ({ invoice: "Invoice", purchase_order: "PO", receipt: "Receipt", credit_memo: "Credit memo", statement: "Statement", other: "Document" })[t] ?? "Document";

const money = (n: number | undefined) =>
  n === undefined ? "?" : n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export type { LedgerEntry };
