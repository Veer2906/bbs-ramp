import "server-only";
import type { PublicVaultEntry, VaultEntry, VaultStatus } from "../types";
import { seal, unseal, vaultKey } from "./crypto";
import { newVaultEntry, storageStatus, store } from "./store";

export const toPublic = ({ passwordCiphertext, ...e }: VaultEntry): PublicVaultEntry => ({ ...e, hasPassword: Boolean(passwordCiphertext) });

export async function listVault(): Promise<PublicVaultEntry[]> {
  return (await store.vault()).sort((a, b) => a.name.localeCompare(b.name)).map(toPublic);
}

export interface VaultInput {
  name?: string;
  url?: string;
  username?: string;
  password?: string;
}

export async function createVaultEntry(input: VaultInput): Promise<VaultEntry> {
  const name = input.name?.trim() || hostOf(input.url) || "Login";
  const entry = newVaultEntry(name, input.url?.trim() ?? "", input.username?.trim() ?? "", input.password || undefined);
  await store.putVault(entry);
  return entry;
}

export async function updateVaultEntry(vid: string, input: VaultInput): Promise<VaultEntry | undefined> {
  const prev = (await store.vault()).find((e) => e.id === vid);
  if (!prev) return undefined;
  const next: VaultEntry = {
    ...prev,
    name: input.name?.trim() || prev.name,
    url: input.url !== undefined ? input.url.trim() : prev.url,
    username: input.username !== undefined ? input.username.trim() : prev.username,
    // Write-only: an empty password keeps the stored one.
    passwordCiphertext: input.password ? seal(input.password, vid) : prev.passwordCiphertext,
    updatedAt: Date.now(),
  };
  await store.putVault(next);
  return next;
}

/** Decrypts a field for typing into the browser. Never returned to the model or the client. */
export async function secretFor(entry: VaultEntry, field: "username" | "password"): Promise<string | undefined> {
  if (field === "username") return entry.username || undefined;
  if (!entry.passwordCiphertext) return undefined;
  const value = unseal(entry.passwordCiphertext, entry.id);
  await store.putVault({ ...entry, lastUsedAt: Date.now() }).catch(() => undefined);
  return value;
}

function hostOf(url?: string) {
  try {
    return url ? new URL(url).host : "";
  } catch {
    return "";
  }
}

/** Finds the vault entry for a page: same origin, longest matching path prefix. */
export function matchVault(entries: VaultEntry[], pageUrl: string): VaultEntry | undefined {
  let page: URL;
  try {
    page = new URL(pageUrl);
  } catch {
    return undefined;
  }
  const sameOrigin = entries.filter((e) => {
    try {
      return new URL(e.url).origin === page.origin;
    } catch {
      return false;
    }
  });
  let best: { e: VaultEntry; len: number } | undefined;
  for (const e of sameOrigin) {
    const p = new URL(e.url).pathname.replace(/[^/]*$/, "");
    if (page.pathname.startsWith(p) && (!best || p.length > best.len)) best = { e, len: p.length };
  }
  if (best && best.len > 1) return best.e;
  return sameOrigin.length === 1 ? sameOrigin[0] : best?.e;
}

export async function vaultStatus(): Promise<VaultStatus> {
  const { source } = vaultKey();
  const entries = await store.vault();
  const sample = entries.find((e) => e.passwordCiphertext);
  let keyOk = true;
  if (sample) {
    try {
      unseal(sample.passwordCiphertext!, sample.id);
    } catch {
      keyOk = false;
    }
  }
  return { cipher: "AES-256-GCM", keySource: source, keyOk, storage: (await storageStatus()).kind };
}
