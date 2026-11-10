import { fail, json } from "@/lib/server/http";
import { dataChanged, runs } from "@/lib/server/runs";
import { store } from "@/lib/server/store";

/** Load the sample October close: a finished chat with its documents, matches and issues. */
export async function POST() {
  if (runs.active()) return fail("Stop the active run before loading sample results", 409);
  try {
    const loaded = await store.loadSample();
    dataChanged();
    return json({ ok: true, ...loaded });
  } catch (e) {
    return fail(e, 503);
  }
}
