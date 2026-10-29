import { fail, json } from "@/lib/server/http";
import { runs, dataChanged } from "@/lib/server/runs";
import { store } from "@/lib/server/store";
import { DEMO_LEDGER } from "@/lib/server/demo";

export async function POST() {
  if (runs.active()) return fail("Stop the active run first", 409);
  store.resetWorkspaceData();
  store.saveLedger(DEMO_LEDGER);
  dataChanged();
  return json({ ok: true });
}
