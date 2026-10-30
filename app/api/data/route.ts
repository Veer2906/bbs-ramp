import { connection } from "next/server";
import { fail, json } from "@/lib/server/http";
import { store } from "@/lib/server/store";

export async function GET() {
  await connection();
  try {
    const [documents, issues, ledger] = await Promise.all([store.documents(), store.issues(), store.ledger()]);
    return json({ documents, issues, ledger });
  } catch (e) {
    return fail(e, 503);
  }
}
