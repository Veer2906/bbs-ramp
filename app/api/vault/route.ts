import { connection } from "next/server";
import { body, fail, json } from "@/lib/server/http";
import { createVaultEntry, listVault, toPublic, vaultStatus, type VaultInput } from "@/lib/server/vault";

export async function GET() {
  await connection();
  try {
    const [entries, status] = await Promise.all([listVault(), vaultStatus()]);
    return json({ entries, status });
  } catch (e) {
    return fail(e, 503);
  }
}

export async function POST(req: Request) {
  const input = await body<VaultInput>(req);
  if (!input.url?.trim() && !input.name?.trim()) return fail("Add a name or login URL");
  try {
    return json(toPublic(await createVaultEntry(input)));
  } catch (e) {
    return fail(e, 503);
  }
}
