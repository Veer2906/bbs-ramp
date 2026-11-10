import "server-only";
import crypto from "node:crypto";
import { env } from "./env";

type G = { __vaultKey?: { key: Buffer; raw: string } };
const g = globalThis as G;

function decodeKey(raw: string): Buffer {
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
  const b = Buffer.from(raw, "base64");
  if (b.length === 32) return b;
  // Any other string is treated as a passphrase.
  return crypto.scryptSync(raw, "ledger-agent-vault", 32);
}

/** The vault key comes from VAULT_KEY (required). It is never stored next to the ciphertext. */
export function vaultKey(): Buffer {
  const raw = env.vaultKey();
  if (!raw) throw new Error("VAULT_KEY is not set. Add it to .env.local, using the key the saved passwords were encrypted with.");
  if (g.__vaultKey?.raw === raw) return g.__vaultKey.key;
  const key = decodeKey(raw);
  g.__vaultKey = { key, raw };
  return key;
}

const b64u = (b: Buffer) => b.toString("base64url");

/** AES-256-GCM. `aad` binds the ciphertext to its record so it can't be swapped onto another entry. */
export function seal(plain: string, aad: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", vaultKey(), iv);
  c.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1.${b64u(iv)}.${b64u(c.getAuthTag())}.${b64u(ct)}`;
}

export function unseal(sealed: string, aad: string): string {
  const [v, iv, tag, ct] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || ct === undefined) throw new Error("unknown vault ciphertext format");
  const d = crypto.createDecipheriv("aes-256-gcm", vaultKey(), Buffer.from(iv, "base64url"));
  d.setAAD(Buffer.from(aad));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
}
