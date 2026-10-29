import { connection } from "next/server";
import { json } from "@/lib/server/http";
import { ensureWorkspace, workspaceStatus } from "@/lib/server/workspace";
import { env } from "@/lib/server/env";

export async function GET() {
  await connection();
  return json(workspaceStatus());
}

export async function POST() {
  if (!env.sailKey()) return json({ state: "error", message: "SAIL_API_KEY is not set" }, 400);
  void ensureWorkspace().catch(() => undefined);
  return json(workspaceStatus());
}
