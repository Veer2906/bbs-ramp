import "server-only";
import type { PublicSettings, Run, RunSummary, Settings } from "../types";
import { env } from "./env";
import { providerAvailability } from "./llm";

export function publicSettings(s: Settings): PublicSettings {
  return {
    ...s,
    portals: s.portals.map(({ password, ...p }) => ({ ...p, hasPassword: Boolean(password) })),
    available: { ...providerAvailability(), sail: Boolean(env.sailKey()) },
  };
}

export const summarize = (r: Run): RunSummary => ({
  id: r.id,
  title: r.title,
  status: r.status,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
  model: r.model,
  usage: r.usage,
});
