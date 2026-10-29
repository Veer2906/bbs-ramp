import { connection } from "next/server";
import { body, json } from "@/lib/server/http";
import { MODEL_OPTIONS } from "@/lib/server/llm";
import { publicSettings } from "@/lib/server/public";
import { store } from "@/lib/server/store";
import type { Portal, Settings } from "@/lib/types";

export async function GET() {
  await connection();
  return json({ settings: publicSettings(store.settings()), models: MODEL_OPTIONS });
}

type PortalInput = Partial<Portal> & { password?: string };

export async function PUT(req: Request) {
  const input = await body<Omit<Settings, "portals"> & { portals: PortalInput[] }>(req);
  const current = store.settings();
  const next: Settings = { ...current };
  if (input.provider === "anthropic" || input.provider === "bedrock") next.provider = input.provider;
  if (typeof input.anthropicModel === "string" && input.anthropicModel.trim()) next.anthropicModel = input.anthropicModel.trim();
  if (typeof input.bedrockModel === "string" && input.bedrockModel.trim()) next.bedrockModel = input.bedrockModel.trim();
  if (typeof input.bedrockRegion === "string" && input.bedrockRegion.trim()) next.bedrockRegion = input.bedrockRegion.trim();
  if (Array.isArray(input.portals)) {
    next.portals = input.portals
      .filter((p) => p.name?.trim() && p.url?.trim())
      .map((p) => {
        const prev = current.portals.find((c) => c.id === p.id);
        const pid = p.id?.trim() || p.name!.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        return {
          id: pid,
          name: p.name!.trim(),
          url: p.url!.trim(),
          username: p.username?.trim() ?? "",
          // Passwords are write-only: an empty field keeps the stored one.
          password: p.password ? p.password : (prev?.password ?? ""),
          notes: p.notes?.trim() || undefined,
        };
      });
  }
  store.saveSettings(next);
  return json({ settings: publicSettings(next), models: MODEL_OPTIONS });
}
