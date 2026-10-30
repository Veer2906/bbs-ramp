import { answerCredential } from "@/lib/server/agent";
import { body, fail, json } from "@/lib/server/http";
import { createVaultEntry, type VaultInput } from "@/lib/server/vault";

type Input = VaultInput & { rid: string; action: "save" | "use" | "skip"; vaultId?: string };

/** Answers a run's login request. The password goes straight into the encrypted vault, never into the run log. */
export async function POST(req: Request, ctx: RouteContext<"/api/runs/[id]/credential">) {
  const { id } = await ctx.params;
  const input = await body<Input>(req);
  if (!input.rid) return fail("Missing request id");
  try {
    if (input.action === "skip") {
      answerCredential(id, input.rid, { skipped: true });
      return json({ ok: true });
    }
    if (input.action === "use" && input.vaultId) {
      answerCredential(id, input.rid, { vaultId: input.vaultId });
      return json({ ok: true, vaultId: input.vaultId });
    }
    if (!input.password) return fail("Enter the password");
    const entry = await createVaultEntry(input);
    answerCredential(id, input.rid, { vaultId: entry.id });
    return json({ ok: true, vaultId: entry.id });
  } catch (e) {
    return fail(e, 409);
  }
}
