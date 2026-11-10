import { fail, json } from "@/lib/server/http";
import { dataChanged, runs } from "@/lib/server/runs";
import { store } from "@/lib/server/store";
import { ensureWorkspace } from "@/lib/server/workspace";

/** Repair demo inputs without removing documents, issues, run history or custom entries. */
export async function POST() {
  if (runs.active()) return fail("Stop the active run before restoring demo data", 409);
  try {
    await store.restoreDemo();
    dataChanged();
    await ensureWorkspace();
    return json({ ok: true });
  } catch (e) {
    return fail(e, 503);
  }
}
