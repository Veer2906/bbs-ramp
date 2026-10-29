import { connection } from "next/server";
import { startRun } from "@/lib/server/agent";
import { body, fail, json } from "@/lib/server/http";
import { summarize } from "@/lib/server/public";
import { runs } from "@/lib/server/runs";
import { store } from "@/lib/server/store";

export async function GET() {
  await connection();
  const saved = store.runs().map((r) => runs.load(r.id) ?? r);
  return json(saved.map(summarize));
}

export async function POST(req: Request) {
  const { instruction } = await body<{ instruction: string }>(req);
  if (!instruction?.trim()) return fail("Write an instruction first");
  try {
    return json(summarize(startRun(instruction.trim())));
  } catch (e) {
    return fail(e, 409);
  }
}
