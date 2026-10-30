import { fail, json } from "@/lib/server/http";
import { runs } from "@/lib/server/runs";
import { store } from "@/lib/server/store";

export async function GET(_req: Request, ctx: RouteContext<"/api/runs/[id]">) {
  const { id } = await ctx.params;
  const run = await runs.load(id).catch(() => undefined);
  if (!run) return fail("Run not found", 404);
  return json({ ...run, frame: runs.get(id)?.frame });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/runs/[id]">) {
  const { id } = await ctx.params;
  if (runs.active()?.run.id === id) return fail("Stop the run before deleting it", 409);
  await store.deleteRun(id);
  return json({ ok: true });
}
