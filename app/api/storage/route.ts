import { connection } from "next/server";
import { json } from "@/lib/server/http";
import { storageStatus } from "@/lib/server/store";

export async function GET() {
  await connection();
  return json(await storageStatus());
}
