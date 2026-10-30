import { body, fail, json } from "@/lib/server/http";
import { store } from "@/lib/server/store";
import type { FinancialDocument } from "@/lib/types";

const EDITABLE = ["status", "ledgerId", "notes", "amount", "number", "date", "dueDate", "poNumber", "vendor", "type"] as const;

export async function PATCH(req: Request, ctx: RouteContext<"/api/documents/[id]">) {
  const { id } = await ctx.params;
  const input = await body<FinancialDocument>(req);
  const patch: Partial<FinancialDocument> = {};
  for (const k of EDITABLE) if (k in input) Object.assign(patch, { [k]: input[k] });
  if (patch.status === "approved" && patch.ledgerId === undefined) {
    const doc = (await store.documents()).find((d) => d.id === id);
    if (doc?.ledgerId) patch.matchConfidence = "exact";
  }
  const doc = await store.updateDocument(id, patch);
  if (!doc) return fail("Document not found", 404);
  return json(doc);
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/documents/[id]">) {
  const { id } = await ctx.params;
  await store.deleteDocument(id);
  return json({ ok: true });
}
