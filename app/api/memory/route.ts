import { connection } from "next/server";
import { body, fail, json } from "@/lib/server/http";
import { createMemory, listMemory, type MemoryInput } from "@/lib/server/memory";

export async function GET() {
  await connection();
  try {
    return json(await listMemory());
  } catch (e) {
    return fail(e, 503);
  }
}

export async function POST(req: Request) {
  try {
    return json(await createMemory(await body<MemoryInput>(req), "user"));
  } catch (e) {
    return fail(e);
  }
}
