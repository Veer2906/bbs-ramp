import { connection } from "next/server";
import { json } from "@/lib/server/http";
import { store } from "@/lib/server/store";

export async function GET() {
  await connection();
  return json({ documents: store.documents(), issues: store.issues(), ledger: store.ledger() });
}
