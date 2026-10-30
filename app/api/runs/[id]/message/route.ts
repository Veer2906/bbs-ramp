import { continueRun } from "@/lib/server/agent";
import { body, fail, json } from "@/lib/server/http";

export async function POST(req: Request, ctx: RouteContext<"/api/runs/[id]/message">) {
  const { id } = await ctx.params;
  const { text } = await body<{ text: string }>(req);
  if (!text?.trim()) return fail("Empty message");
  try {
    await continueRun(id, text.trim());
    return json({ ok: true });
  } catch (e) {
    return fail(e, 409);
  }
}
