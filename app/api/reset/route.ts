import { fail, json } from "@/lib/server/http";
import { runs, dataChanged } from "@/lib/server/runs";
import { store } from "@/lib/server/store";

export async function POST() {
  if (runs.active()) return fail("Stop the active run first", 409);
  await store.resetWorkspace();
  dataChanged();
  return json({ ok: true });
}
