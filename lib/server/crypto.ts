import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { env } from "./env";

type G = { __vaultKey?: { key: Buffer; source: "env" | "file"; raw: string } };
const g = globalThis as G;

function decodeKey(raw: string): Buffer {
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
  const b = Buffer.from(raw, "base64");
  if (b.length === 32) return b;
  // Any other string is treated as a passphrase.
  return crypto.scryptSync(raw, "ledger-agent-vault", 32);
}

/** The vault key comes from VAULT_KEY, or is generated once into the data directory (mode 600). */
export function vaultKey() {
  const fromEnv = env.vaultKey();
  if (g.__vaultKey && (fromEnv ? g.__vaultKey.raw === fromEnv : g.__vaultKey.source === "file")) return g.__vaultKey;
  if (fromEnv) return (g.__vaultKey = { key: decodeKey(fromEnv), source: "env", raw: fromEnv });
  const file = path.join(env.dataDir(), "vault.key");
  let raw = "";
  try {
    raw = fs.readFileSync(file, "utf8").trim();
  } catch {
    raw = crypto.randomBytes(32).toString("base64");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${raw}\n`, { mode: 0o600, flag: "wx" });
  }
  return (g.__vaultKey = { key: decodeKey(raw), source: "file", raw });
}

const b64u = (b: Buffer) => b.toString("base64url");

/** AES-256-GCM. `aad` binds the ciphertext to its record so it can't be swapped onto another entry. */
export function seal(plain: string, aad: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", vaultKey().key, iv);
  c.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1.${b64u(iv)}.${b64u(c.getAuthTag())}.${b64u(ct)}`;
}

export function unseal(sealed: string, aad: string): string {
  const [v, iv, tag, ct] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || ct === undefined) throw new Error("unknown vault ciphertext format");
  const d = crypto.createDecipheriv("aes-256-gcm", vaultKey().key, Buffer.from(iv, "base64url"));
  d.setAAD(Buffer.from(aad));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
}
