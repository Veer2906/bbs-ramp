import { body, fail, json } from "@/lib/server/http";
import { deleteMemory, updateMemory, type MemoryInput } from "@/lib/server/memory";

export async function PATCH(req: Request, ctx: RouteContext<"/api/memory/[id]">) {
  const { id } = await ctx.params;
  try {
    const node = await updateMemory(id, await body<MemoryInput>(req));
    if (!node) return fail("Memory not found", 404);
    return json(node);
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/memory/[id]">) {
  const { id } = await ctx.params;
  await deleteMemory(id);
  return json({ ok: true });
}
