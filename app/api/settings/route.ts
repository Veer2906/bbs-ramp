import { connection } from "next/server";
import { body, fail, json } from "@/lib/server/http";
import { MODEL_OPTIONS } from "@/lib/server/llm";
import { publicSettings } from "@/lib/server/public";
import { storageStatus, store } from "@/lib/server/store";
import type { Portal, Settings } from "@/lib/types";

export async function GET() {
  await connection();
  try {
    return json({ settings: await publicSettings(await store.settings()), models: MODEL_OPTIONS });
  } catch {
    // Storage is not usable yet (e.g. Supabase tables missing); still let the UI explain why.
    const storage = await storageStatus();
    return json({ settings: null, storage, models: MODEL_OPTIONS }, 503);
  }
}

export async function PUT(req: Request) {
  const input = await body<Omit<Settings, "portals"> & { portals: Partial<Portal>[] }>(req);
  try {
    const current = await store.settings();
    const next: Settings = { ...current };
    if (input.provider === "anthropic" || input.provider === "bedrock") next.provider = input.provider;
    if (typeof input.anthropicModel === "string" && input.anthropicModel.trim()) next.anthropicModel = input.anthropicModel.trim();
    if (typeof input.bedrockModel === "string" && input.bedrockModel.trim()) next.bedrockModel = input.bedrockModel.trim();
    if (typeof input.bedrockRegion === "string" && input.bedrockRegion.trim()) next.bedrockRegion = input.bedrockRegion.trim();
    if (Array.isArray(input.portals)) {
      next.portals = input.portals
        .filter((p) => p.name?.trim() && p.url?.trim())
        .map((p) => ({
          id: p.id?.trim() || p.name!.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
          name: p.name!.trim(),
          url: p.url!.trim(),
          notes: p.notes?.trim() || undefined,
        }));
    }
    await store.saveSettings(next);
    return json({ settings: await publicSettings(next), models: MODEL_OPTIONS });
  } catch (e) {
    return fail(e, 503);
  }
}
