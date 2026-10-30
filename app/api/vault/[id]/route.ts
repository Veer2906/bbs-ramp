import { body, fail, json } from "@/lib/server/http";
import { store } from "@/lib/server/store";
import { toPublic, updateVaultEntry, type VaultInput } from "@/lib/server/vault";

export async function PATCH(req: Request, ctx: RouteContext<"/api/vault/[id]">) {
  const { id } = await ctx.params;
  const entry = await updateVaultEntry(id, await body<VaultInput>(req));
  if (!entry) return fail("Vault entry not found", 404);
  return json(toPublic(entry));
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/vault/[id]">) {
  const { id } = await ctx.params;
  await store.deleteVault(id);
  return json({ ok: true });
}
