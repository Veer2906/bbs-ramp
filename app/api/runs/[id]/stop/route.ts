import { stopRun } from "@/lib/server/agent";
import { json } from "@/lib/server/http";

export async function POST(_req: Request, ctx: RouteContext<"/api/runs/[id]/stop">) {
  const { id } = await ctx.params;
  stopRun(id);
  return json({ ok: true });
}
