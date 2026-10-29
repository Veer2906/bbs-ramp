"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api, type WorkspaceState } from "@/lib/client/api";
import type { Provider, PublicPortal } from "@/lib/types";
import { Button, PageHeader, Panel, Segmented, cx, inputClass } from "./ui";
import { useWorkspace } from "./workspace-provider";

type PortalDraft = Partial<PublicPortal> & { password?: string; key: string };

export function SettingsView() {
  const { settings, setSettings, refreshData, refreshRuns } = useWorkspace();
  const router = useRouter();
  const [provider, setProvider] = useState<Provider>("anthropic");
  const [anthropicModel, setAnthropicModel] = useState("");
  const [bedrockModel, setBedrockModel] = useState("");
  const [bedrockRegion, setBedrockRegion] = useState("");
  const [portals, setPortals] = useState<PortalDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [box, setBox] = useState<WorkspaceState>();
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!settings) return;
    const s = settings.settings;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProvider(s.provider);
    setAnthropicModel(s.anthropicModel);
    setBedrockModel(s.bedrockModel);
    setBedrockRegion(s.bedrockRegion);
    setPortals(s.portals.map((p) => ({ ...p, key: p.id })));
  }, [settings]);

  useEffect(() => {
    api.workspace().then(setBox).catch(() => undefined);
  }, []);

  if (!settings) return null;
  const available = settings.settings.available;
  const models = settings.models;

  const save = async () => {
    setSaving(true);
    try {
      const next = await api.saveSettings({
        provider,
        anthropicModel,
        bedrockModel,
        bedrockRegion,
        portals: portals.map((p) => ({ id: p.id, name: p.name, url: p.url, username: p.username, password: p.password, notes: p.notes })),
      });
      setSettings(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } finally {
      setSaving(false);
    }
  };

  const patch = (key: string, p: Partial<PortalDraft>) => setPortals((all) => all.map((x) => (x.key === key ? { ...x, ...p } : x)));

  return (
    <div className="scroll-thin h-full overflow-y-auto pb-16">
      <PageHeader
        title="Settings"
        actions={
          <Button variant="primary" loading={saving} onClick={() => void save()}>
            {saved ? "Saved" : "Save changes"}
          </Button>
        }
      />
      <div className="flex max-w-[760px] flex-col gap-8 px-8">
        <Section title="Model" hint="Claude drives the browser and reads documents. Bedrock runs the same models through your AWS account.">
          <Panel className="flex flex-col gap-5 p-5">
            <div className="flex items-center justify-between gap-4">
              <Segmented<Provider>
                value={provider}
                onChange={setProvider}
                options={[
                  { value: "anthropic", label: "Anthropic API" },
                  { value: "bedrock", label: "AWS Bedrock" },
                ]}
              />
              <span className={cx("text-[12.5px]", available[provider] ? "text-emerald-700" : "text-amber-700")}>
                {available[provider]
                  ? "Credentials found"
                  : provider === "anthropic"
                    ? "Set ANTHROPIC_API_KEY in .env.local"
                    : "Set AWS_BEARER_TOKEN_BEDROCK or AWS keys in .env.local"}
              </span>
            </div>
            <Field label="Model">
              <ModelPicker
                options={models[provider]}
                value={provider === "anthropic" ? anthropicModel : bedrockModel}
                onChange={provider === "anthropic" ? setAnthropicModel : setBedrockModel}
              />
            </Field>
            {provider === "bedrock" ? (
              <Field label="AWS region">
                <input className={inputClass} value={bedrockRegion} onChange={(e) => setBedrockRegion(e.target.value)} placeholder="us-east-1" />
              </Field>
            ) : null}
          </Panel>
        </Section>

        <Section title="Vendor portals" hint="Credentials stay on this server. The agent types them into login forms without ever seeing them.">
          <div className="flex flex-col gap-3">
            {portals.map((p) => (
              <Panel key={p.key} className="grid grid-cols-2 gap-3 p-5">
                <Field label="Name">
                  <input className={inputClass} value={p.name ?? ""} onChange={(e) => patch(p.key, { name: e.target.value })} />
                </Field>
                <Field label="Login URL">
                  <input className={inputClass} value={p.url ?? ""} onChange={(e) => patch(p.key, { url: e.target.value })} placeholder="https://" />
                </Field>
                <Field label="Username">
                  <input className={inputClass} value={p.username ?? ""} onChange={(e) => patch(p.key, { username: e.target.value })} autoComplete="off" />
                </Field>
                <Field label="Password">
                  <input
                    className={inputClass}
                    type="password"
                    value={p.password ?? ""}
                    onChange={(e) => patch(p.key, { password: e.target.value })}
                    placeholder={p.hasPassword ? "Saved, type to replace" : "Not set"}
                    autoComplete="new-password"
                  />
                </Field>
                <div className="col-span-2 flex items-end gap-3">
                  <div className="flex-1">
                    <Field label="Notes for the agent">
                      <input className={inputClass} value={p.notes ?? ""} onChange={(e) => patch(p.key, { notes: e.target.value })} placeholder="Where documents live, quirks, account numbers" />
                    </Field>
                  </div>
                  <Button variant="danger" onClick={() => setPortals((all) => all.filter((x) => x.key !== p.key))} title="Remove portal">
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </Panel>
            ))}
            <Button className="self-start" onClick={() => setPortals((all) => [...all, { key: `new-${Date.now()}`, name: "", url: "", username: "" }])}>
              <Plus className="size-3.5" />
              Add portal
            </Button>
          </div>
        </Section>

        <Section title="Cloud computer" hint="A persistent Sail sandbox with a real browser. Logins, cookies and downloads survive between tasks.">
          <Panel className="flex items-center justify-between gap-4 p-5">
            <div className="min-w-0">
              <p className="text-[13.5px] font-medium text-zinc-900">
                {box?.state === "ready" ? "Ready" : box?.state === "provisioning" ? "Starting" : box?.state === "error" ? "Unavailable" : available.sail ? "Asleep" : "Not configured"}
              </p>
              <p className="truncate text-[12.5px] text-zinc-500">
                {!available.sail ? "Set SAIL_API_KEY in .env.local" : box?.message ?? box?.sailboxId ?? "Created on first task"}
              </p>
            </div>
            {available.sail ? (
              <Button onClick={() => void api.warmWorkspace().then(setBox)} disabled={box?.state === "provisioning" || box?.state === "ready"}>
                Wake now
              </Button>
            ) : null}
          </Panel>
        </Section>

        <Section title="Data" hint="Clears retrieved documents, issues and task history, and restores the sample ledger.">
          <Button
            variant="danger"
            className="self-start"
            loading={resetting}
            onClick={async () => {
              if (!confirm("Clear all documents, issues and tasks?")) return;
              setResetting(true);
              try {
                await api.reset();
                await Promise.all([refreshData(), refreshRuns()]);
                router.push("/");
              } finally {
                setResetting(false);
              }
            }}
          >
            Reset workspace
          </Button>
        </Section>
      </div>
    </div>
  );
}

function ModelPicker({ options, value, onChange }: { options: { id: string; label: string; hint: string }[]; value: string; onChange: (v: string) => void }) {
  const known = options.some((o) => o.id === value);
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={cx(
              "rounded-xl px-3.5 py-2.5 text-left transition-all",
              o.id === value ? "bg-zinc-900 text-white" : "bg-zinc-900/[0.04] text-zinc-800 hover:bg-zinc-900/[0.07]"
            )}
          >
            <p className="text-[13px] font-medium">{o.label}</p>
            <p className={cx("text-[12px]", o.id === value ? "text-zinc-300" : "text-zinc-500")}>{o.hint}</p>
          </button>
        ))}
      </div>
      <input className={cx(inputClass, "font-mono text-[12px]")} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Or enter any model id" />
      {!known && value ? <p className="text-[12px] text-zinc-500">Custom model id</p> : null}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col">
      <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">{title}</h2>
      {hint ? <p className="mt-0.5 mb-3 text-[13px] text-zinc-500">{hint}</p> : <div className="mb-3" />}
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-medium text-zinc-500">{label}</span>
      {children}
    </label>
  );
}
