import type Anthropic from "@anthropic-ai/sdk";

type Tool = Anthropic.Tool;

const ref = { type: "integer", description: "Element ref number from the latest page snapshot, e.g. 12 for [12 link ...]" } as const;

export const TOOLS: Tool[] = [
  {
    name: "update_plan",
    description: "Set or update your step-by-step plan. Call it first, then whenever a step starts or finishes. Keep 3-7 short steps.",
    input_schema: {
      type: "object",
      properties: {
        steps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              status: { type: "string", enum: ["pending", "active", "done", "skipped"] },
            },
            required: ["title", "status"],
          },
        },
      },
      required: ["steps"],
    },
  },
  {
    name: "goto",
    description: "Open a URL in the browser. Returns the page snapshot.",
    input_schema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
  },
  {
    name: "click",
    description: "Click an element. If it starts a file download, the saved file is listed under Downloads.",
    input_schema: { type: "object", properties: { ref }, required: ["ref"] },
  },
  {
    name: "type",
    description: "Replace the value of a text field. Set submit=true to press Enter afterwards.",
    input_schema: {
      type: "object",
      properties: { ref, text: { type: "string" }, submit: { type: "boolean" } },
      required: ["ref", "text"],
    },
  },
  {
    name: "fill_credential",
    description:
      "Type a login from the vault into a field without revealing it. Use this for every login instead of typing secrets. If you omit vault_id, the vault entry matching the current page is used.",
    input_schema: {
      type: "object",
      properties: {
        ref,
        vault_id: { type: "string" },
        field: { type: "string", enum: ["username", "password"] },
        submit: { type: "boolean" },
      },
      required: ["ref", "field"],
    },
  },
  {
    name: "select",
    description: "Choose an option in a <select> by its visible label.",
    input_schema: { type: "object", properties: { ref, option: { type: "string" } }, required: ["ref", "option"] },
  },
  {
    name: "check",
    description: "Tick or untick a checkbox or radio.",
    input_schema: { type: "object", properties: { ref, checked: { type: "boolean" } }, required: ["ref"] },
  },
  {
    name: "press",
    description: "Press a keyboard key such as Enter, Tab, Escape, PageDown.",
    input_schema: { type: "object", properties: { key: { type: "string" } }, required: ["key"] },
  },
  {
    name: "scroll",
    description: "Scroll the page. Only needed for pages that lazy-load content; snapshots already include off-screen text.",
    input_schema: { type: "object", properties: { direction: { type: "string", enum: ["down", "up"] } }, required: ["direction"] },
  },
  { name: "back", description: "Go back one page in history.", input_schema: { type: "object", properties: {} } },
  {
    name: "switch_tab",
    description: "Switch to another open tab by index (see Tabs in the snapshot).",
    input_schema: { type: "object", properties: { index: { type: "integer" } }, required: ["index"] },
  },
  {
    name: "wait",
    description: "Wait for slow pages, up to 10 seconds.",
    input_schema: { type: "object", properties: { seconds: { type: "number" } }, required: ["seconds"] },
  },
  {
    name: "screenshot",
    description: "See the page as an image. Use only when the text snapshot is confusing (charts, image-only content, layout questions).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "download_url",
    description:
      "Download a document link directly with the browser's session cookies (fast path when a link's href is visible). Relative URLs resolve against the current page.",
    input_schema: {
      type: "object",
      properties: { url: { type: "string" }, filename: { type: "string" } },
      required: ["url"],
    },
  },
  {
    name: "save_page_as_pdf",
    description: "Save the current page as a PDF file. Use for documents shown only as printable HTML pages.",
    input_schema: { type: "object", properties: { filename: { type: "string" } }, required: ["filename"] },
  },
  {
    name: "read_document",
    description: "Extract the text of a downloaded file (PDF, HTML, CSV, image). Always read a document before recording it.",
    input_schema: { type: "object", properties: { file: { type: "string", description: "File name from Downloads" } }, required: ["file"] },
  },
  {
    name: "list_files",
    description: "List files downloaded in the cloud computer.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "record_document",
    description:
      "Save a retrieved document to the central repository with fields extracted from the document itself. Returns its document_id. Duplicates (same vendor, type and number) are detected.",
    input_schema: {
      type: "object",
      properties: {
        file: { type: "string", description: "Downloaded file name" },
        type: { type: "string", enum: ["invoice", "purchase_order", "receipt", "credit_memo", "statement", "other"] },
        vendor: { type: "string" },
        number: { type: "string", description: "Document number, e.g. invoice number" },
        date: { type: "string", description: "YYYY-MM-DD" },
        due_date: { type: "string", description: "YYYY-MM-DD" },
        amount: { type: "number", description: "Document total" },
        currency: { type: "string" },
        po_number: { type: "string" },
        reference: { type: "string", description: "Other reference, e.g. invoice a receipt applies to" },
        line_items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              quantity: { type: "number" },
              unit_price: { type: "number" },
              amount: { type: "number" },
            },
            required: ["description"],
          },
        },
        source_url: { type: "string" },
        notes: { type: "string" },
      },
      required: ["file", "type", "vendor", "number", "amount"],
    },
  },
  {
    name: "get_ledger",
    description: "Read the company's purchase ledger (expected transactions) with current match status. Filter by vendor and/or date range.",
    input_schema: {
      type: "object",
      properties: {
        vendor: { type: "string" },
        from: { type: "string", description: "YYYY-MM-DD" },
        to: { type: "string", description: "YYYY-MM-DD" },
      },
    },
  },
  {
    name: "match_document",
    description: "Link a recorded document to the ledger transaction it supports. Amount differences are flagged automatically.",
    input_schema: {
      type: "object",
      properties: {
        document_id: { type: "string" },
        ledger_id: { type: "string" },
        confidence: { type: "string", enum: ["exact", "probable", "uncertain"] },
        note: { type: "string" },
      },
      required: ["document_id", "ledger_id", "confidence"],
    },
  },
  {
    name: "flag_issue",
    description:
      "Record a validation finding for human review: missing document, amount mismatch, duplicate, ambiguous match, document not in ledger (unrecorded), or portal access problem.",
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["missing_document", "amount_mismatch", "duplicate", "ambiguous", "unrecorded", "access", "other"] },
        severity: { type: "string", enum: ["high", "medium", "low"] },
        title: { type: "string", description: "One line" },
        detail: { type: "string", description: "Evidence and suggested next step" },
        ledger_id: { type: "string" },
        document_ids: { type: "array", items: { type: "string" } },
      },
      required: ["kind", "severity", "title", "detail"],
    },
  },
  {
    name: "request_credentials",
    description:
      "You hit a login with no vault entry, or the stored login was rejected. Shows the user a secure form to save the login to the encrypted vault, then waits. Returns the new vault_id for fill_credential, or tells you the user skipped. Never ask for passwords any other way.",
    input_schema: {
      type: "object",
      properties: {
        site_name: { type: "string", description: "Vendor or site name, e.g. Acme Industrial Parts" },
        login_url: { type: "string", description: "The login page URL" },
        reason: { type: "string", description: "One short sentence, e.g. 'No saved login for this portal' or 'The saved password was rejected'" },
        username_hint: { type: "string", description: "What the username field is called on the page, if unusual (account number, customer ID)" },
      },
      required: ["site_name", "login_url", "reason"],
    },
  },
  {
    name: "remember",
    description:
      "Save a durable fact to active memory so every future task sees it: key dates (close dates, payment terms deadlines), key invoices (disputed, large, recurring), vendor quirks (portal layout, account numbers, contacts), and user preferences or rules. Only save facts that will matter beyond this task; never save passwords. Saving a title that already exists updates it.",
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["date", "invoice", "vendor", "rule", "note"] },
        title: { type: "string", description: "Short name, e.g. 'October close' or 'AC-INV-2307'" },
        detail: { type: "string", description: "One or two sentences with the specifics" },
        link_titles: { type: "array", items: { type: "string" }, description: "Titles of related memory nodes, e.g. the vendor of an invoice" },
        id: { type: "string", description: "Existing memory id to update" },
      },
      required: ["kind", "title", "detail"],
    },
  },
  {
    name: "ask_human",
    description:
      "Ask the user a question and wait for the answer. Only for decisions you cannot make from the evidence (MFA codes, genuinely ambiguous instructions). Never for passwords or logins: use request_credentials. Offer short options when possible.",
    input_schema: {
      type: "object",
      properties: { question: { type: "string" }, options: { type: "array", items: { type: "string" } } },
      required: ["question"],
    },
  },
  {
    name: "finish",
    description: "End the task with a short summary for the finance team: what was retrieved, matched, and what needs attention.",
    input_schema: { type: "object", properties: { summary: { type: "string" } }, required: ["summary"] },
  },
];

export const BROWSER_TOOLS = new Set([
  "goto",
  "click",
  "type",
  "fill_credential",
  "select",
  "check",
  "press",
  "scroll",
  "back",
  "switch_tab",
  "wait",
  "screenshot",
]);
