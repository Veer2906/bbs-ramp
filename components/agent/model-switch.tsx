"use client";

import { useState } from "react";
import { api } from "@/lib/client/api";
import type { Provider } from "@/lib/types";
import { Icon } from "../icon";
import { cx } from "../ui";
import { useWorkspace } from "../workspace-provider";

const GROUPS: { provider: Provider; label: string; key: "anthropicModel" | "bedrockModel" | "openaiModel" }[] = [
  { provider: "anthropic", label: "Anthropic", key: "anthropicModel" },
  { provider: "openai", label: "OpenAI", key: "openaiModel" },
  { provider: "bedrock", label: "AWS Bedrock", key: "bedrockModel" },
];

/** Compact model picker for the chat box. The choice is saved to settings and used by the next message. */
export function ModelSwitch() {
  const { settings, setSettings } = useWorkspace();
  const [open, setOpen] = useState(false);
  const s = settings?.settings;
  if (!s || !settings) return null;
  const group = GROUPS.find((g) => g.provider === s.provider) ?? GROUPS[0];
  const current = s[group.key];
  const label = settings.models[s.provider]?.find((m) => m.id === current)?.label ?? current;

  const pick = async (g: (typeof GROUPS)[number], id: string) => {
    setOpen(false);
    setSettings(await api.saveSettings({ provider: g.provider, [g.key]: id }));
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cx("press flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium text-zinc-600 hover:bg-zinc-900/[0.07] hover:text-zinc-900", open && "bg-zinc-900/[0.07] text-zinc-900")}
      >
        {label}
        <Icon name="chevron" size={13} className={cx("transition-transform duration-200", open ? "rotate-180" : "")} />
      </button>
      {open ? (
        <>
          <button type="button" aria-label="Close" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <div className="pop sheet absolute bottom-full left-0 z-20 mb-2 w-[272px] rounded-[14px] p-1.5">
            {GROUPS.map((g) => {
              const ready = s.available[g.provider];
              return (
                <div key={g.provider} className="py-1">
                  <p className="flex items-center justify-between px-2.5 pt-1 pb-1.5 text-[12px] text-zinc-400">
                    {g.label}
                    {!ready ? <span>No key</span> : null}
                  </p>
                  {settings.models[g.provider]?.map((m) => {
                    const on = s.provider === g.provider && current === m.id;
                    return (
                      <button
                        type="button"
                        key={m.id}
                        disabled={!ready}
                        onClick={() => void pick(g, m.id)}
                        className={cx(
                          "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors",
                          on ? "bg-zinc-900/[0.1] text-zinc-900" : "text-zinc-700 hover:bg-zinc-900/[0.06]",
                          "disabled:cursor-not-allowed disabled:opacity-40"
                        )}
                      >
                        <span className="flex-1">{m.label}</span>
                        <span className="text-[11.5px] text-zinc-400">{m.hint}</span>
                        {on ? <Icon name="check" size={13} className="text-zinc-900" /> : null}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
