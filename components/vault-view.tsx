"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "./icon";
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
    <div className="scroll-thin flex h-full flex-col overflow-y-auto pb-8">
      <PageHeader
        title="Vault"
        subtitle="Logins the agent signs in with. Each password is encrypted before it is saved. The agent can type it into a login page but cannot read it."
        actions={
          <Button variant="primary" onClick={() => setEditing("new")} disabled={editing === "new"}>
            <Icon name="plus" size={15} />
            Add login
          </Button>
        }
      />
      <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col gap-3 px-5 sm:px-8">
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
          <div className="flex flex-1 items-center justify-center">
            <Empty title="No saved logins" hint="Add one now, or the agent will ask for it the first time it reaches a login page." />
          </div>
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
              <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-zinc-900/[0.07] text-zinc-600">
                <Icon name="key" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-zinc-900">{e.name}</p>
                <p className="flex gap-3 truncate text-[12.5px] text-zinc-500">
                  <span>{e.username || "No username"}</span>
                  {e.url ? <span className="truncate text-zinc-400">{e.url.replace(/^https?:\/\//, "")}</span> : null}
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
  if (status.keyOk) return null;
  return (
    <div className="mb-2 flex flex-col gap-1">
      <p className="rounded-[10px] bg-rose-500/[0.12] px-3 py-2 text-[12.5px] text-rose-800">
        VAULT_KEY is missing or cannot decrypt the saved passwords. Set it in .env.local to the key the passwords were saved with, or re-enter the passwords.
      </p>
    </div>
  );
}

export function EntryForm({
  entry,
  initial,
  submitLabel = "Save",
  usernameLabel = "Username",
  bare,
  onSave,
  onCancel,
  onDelete,
}: {
  entry?: PublicVaultEntry;
  initial?: VaultDraft;
  submitLabel?: string;
  usernameLabel?: string;
  /** Render without the surrounding Panel, for embedding inside another card. */
  bare?: boolean;
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

  const form = (
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
  );
  return bare ? form : <Panel className="p-5">{form}</Panel>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="eyebrow">{label}</span>
      {children}
    </label>
  );
}
