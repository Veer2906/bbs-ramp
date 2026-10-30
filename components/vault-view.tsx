"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Plus } from "lucide-react";
import { api, ago, type VaultDraft } from "@/lib/client/api";
import type { PublicVaultEntry, VaultStatus } from "@/lib/types";
import { Button, Empty, PageHeader, Panel, Pill, inputClass } from "./ui";

export function VaultView() {
  const [entries, setEntries] = useState<PublicVaultEntry[]>();
  const [status, setStatus] = useState<VaultStatus>();
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState<string>();

  const load = useCallback(async () => {
    try {
      const v = await api.vault();
      setEntries(v.entries);
      setStatus(v.status);
      setError(undefined);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return (
    <div className="scroll-thin h-full overflow-y-auto pb-16">
      <PageHeader
        title="Vault"
        subtitle="Logins the agent signs in with. Passwords are encrypted before they are stored, and the agent types them without ever seeing them."
        actions={
          <Button variant="primary" onClick={() => setEditing("new")} disabled={editing === "new"}>
            <Plus className="size-3.5" />
            Add login
          </Button>
        }
      />
      <div className="flex max-w-[760px] flex-col gap-3 px-8">
        {status ? <StatusLine status={status} /> : null}
        {error ? <p className="text-[13px] text-rose-600">{error}</p> : null}
        {editing === "new" ? (
          <EntryForm
            onCancel={() => setEditing(undefined)}
            onSave={async (d) => {
              await api.addVault(d);
              setEditing(undefined);
              await load();
            }}
          />
        ) : null}
        {entries?.length === 0 && editing !== "new" ? (
          <Empty title="No saved logins" hint="Add one now, or the agent will ask for it the first time it reaches a login page." />
        ) : null}
        {entries?.map((e) =>
          editing === e.id ? (
            <EntryForm
              key={e.id}
              entry={e}
              onCancel={() => setEditing(undefined)}
              onSave={async (d) => {
                await api.updateVault(e.id, d);
                setEditing(undefined);
                await load();
              }}
              onDelete={async () => {
                if (!confirm(`Delete the login for ${e.name}?`)) return;
                await api.deleteVault(e.id);
                setEditing(undefined);
                await load();
              }}
            />
          ) : (
            <Panel key={e.id} className="flex items-center gap-4 px-5 py-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-zinc-900/[0.05]">
                <KeyRound className="size-4 text-zinc-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-zinc-900">{e.name}</p>
                <p className="truncate text-[12.5px] text-zinc-500">
                  {e.username || "No username"}
                  {e.url ? <span className="text-zinc-400">{`  ·  ${e.url.replace(/^https?:\/\//, "")}`}</span> : null}
                </p>
              </div>
              <span className="hidden text-[12px] text-zinc-400 sm:block">{e.lastUsedAt ? `Used ${ago(e.lastUsedAt)}` : "Not used yet"}</span>
              {e.hasPassword ? <Pill tone="green">Encrypted</Pill> : <Pill tone="amber">No password</Pill>}
              <Button size="sm" variant="ghost" onClick={() => setEditing(e.id)}>
                Edit
              </Button>
            </Panel>
          )
        )}
      </div>
    </div>
  );
}

function StatusLine({ status }: { status: VaultStatus }) {
  const where = status.storage === "supabase" ? "Stored in Supabase" : "Stored on this computer";
  const key = status.keySource === "env" ? "key from VAULT_KEY" : "key generated in .data/vault.key";
  return (
    <div className="mb-2 flex flex-col gap-1">
      <p className="text-[12.5px] text-zinc-500">{`${status.cipher} encryption, ${key}. ${where}.`}</p>
      {!status.keyOk ? (
        <p className="rounded-xl bg-rose-500/[0.07] px-3 py-2 text-[12.5px] text-rose-800">
          The current key cannot decrypt the saved passwords. Set VAULT_KEY to the key they were saved with, or re-enter the passwords.
        </p>
      ) : status.keySource === "file" && status.storage === "supabase" ? (
        <p className="rounded-xl bg-amber-500/[0.08] px-3 py-2 text-[12.5px] text-amber-900">
          Passwords are in Supabase but the key only exists on this computer. Copy .data/vault.key into VAULT_KEY in .env.local so other machines can use the vault.
        </p>
      ) : null}
    </div>
  );
}

export function EntryForm({
  entry,
  initial,
  submitLabel = "Save",
  usernameLabel = "Username",
  onSave,
  onCancel,
  onDelete,
}: {
  entry?: PublicVaultEntry;
  initial?: VaultDraft;
  submitLabel?: string;
  usernameLabel?: string;
  onSave: (d: VaultDraft) => Promise<void>;
  onCancel?: () => void;
  onDelete?: () => Promise<void>;
}) {
  const [d, setD] = useState<VaultDraft>({ name: entry?.name ?? initial?.name ?? "", url: entry?.url ?? initial?.url ?? "", username: entry?.username ?? initial?.username ?? "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const set = (k: keyof VaultDraft) => (e: React.ChangeEvent<HTMLInputElement>) => setD((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entry && !d.password) return setError("Enter the password");
    setBusy(true);
    setError(undefined);
    try {
      await onSave(d);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel className="p-5">
      <form onSubmit={(e) => void submit(e)} className="grid grid-cols-2 gap-3" autoComplete="off">
        <Field label="Name">
          <input className={inputClass} value={d.name} onChange={set("name")} placeholder="Vendor name" />
        </Field>
        <Field label="Login URL">
          <input className={inputClass} value={d.url} onChange={set("url")} placeholder="https://" />
        </Field>
        <Field label={usernameLabel}>
          <input className={inputClass} value={d.username} onChange={set("username")} autoComplete="off" autoFocus={!entry} />
        </Field>
        <Field label="Password">
          <input
            className={inputClass}
            type="password"
            value={d.password}
            onChange={set("password")}
            placeholder={entry?.hasPassword ? "Saved, type to replace" : ""}
            autoComplete="new-password"
          />
        </Field>
        <div className="col-span-2 mt-1 flex items-center gap-2">
          <Button type="submit" variant="primary" loading={busy}>
            {submitLabel}
          </Button>
          {onCancel ? (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          {error ? <span className="text-[12.5px] text-rose-600">{error}</span> : null}
          <span className="flex-1" />
          {onDelete ? (
            <Button type="button" variant="danger" onClick={() => void onDelete()}>
              Delete
            </Button>
          ) : null}
        </div>
      </form>
    </Panel>
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
