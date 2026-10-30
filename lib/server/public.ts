import "server-only";
import type { PublicSettings, Run, RunSummary, Settings } from "../types";
import { env } from "./env";
import { providerAvailability } from "./llm";
import { storageStatus, store } from "./store";
import { matchVault } from "./vault";

export async function publicSettings(s: Settings): Promise<PublicSettings> {
  const [vault, storage] = await Promise.all([store.vault(), storageStatus()]);
  return {
    ...s,
    portals: s.portals.map((p) => ({ ...p, vaultId: matchVault(vault, p.url)?.id })),
    available: { ...providerAvailability(), sail: Boolean(env.sailKey()) },
    storage,
  };
}

export const summarize = (r: Run | RunSummary): RunSummary => ({
  id: r.id,
  title: r.title,
  status: r.status,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
  model: r.model,
  usage: r.usage,
});
