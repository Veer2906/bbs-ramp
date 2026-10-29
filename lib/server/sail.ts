import "server-only";
import { env } from "./env";

const BOX_API = "https://sailbox-api.sailresearch.com/v1";
const APP_API = "https://api.sailresearch.com/v1";

export class SailError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

function headers(extra: Record<string, string> = {}) {
  const key = env.sailKey();
  if (!key) throw new SailError("SAIL_API_KEY is not set");
  return { Authorization: `Bearer ${key}`, ...extra };
}

async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...init, headers: headers(init.headers as Record<string, string>), cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new SailError(`Sail ${init.method ?? "GET"} ${url.replace(BOX_API, "")} -> ${res.status}: ${body.slice(0, 300)}`, res.status);
  }
  return (await res.json()) as T;
}

export interface SailboxInfo {
  sailbox_id: string;
  status: string;
  name?: string;
  error_message?: string;
}

export const sail = {
  async findApp(name: string) {
    return call<{ id: string; name: string }>(`${APP_API}/apps/find`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, mint_if_missing: true }),
    });
  },

  async create(appId: string, name: string, idempotencyKey: string) {
    return call<SailboxInfo>(`${BOX_API}/sailboxes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ app_id: appId, name, size: "m", image: { base: "BASE_IMAGE_DEBIAN" } }),
    });
  },

  async get(id: string) {
    return call<SailboxInfo>(`${BOX_API}/sailboxes/${id}`);
  },

  async resume(id: string) {
    return call<unknown>(`${BOX_API}/sailboxes/${id}/resume`, { method: "POST" });
  },

  async exec(id: string, command: string, timeoutSeconds = 120): Promise<{ stdout: string; stderr: string; code: number }> {
    const res = await fetch(`${BOX_API}/sailboxes/${id}/exec`, {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ command, timeout: timeoutSeconds }),
      cache: "no-store",
    });
    if (!res.ok || !res.body) {
      throw new SailError(`Sail exec -> ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`, res.status);
    }
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    let code = -1;
    let failure: string | undefined;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    const handle = (line: string) => {
      if (!line.trim()) return;
      const e = JSON.parse(line);
      if (e.type === "stdout") out.push(Buffer.from(e.data, "base64"));
      else if (e.type === "stderr") err.push(Buffer.from(e.data, "base64"));
      else if (e.type === "exit") code = e.return_code ?? (e.status === "succeeded" ? 0 : 1);
      else if (e.type === "error") failure = `${e.error_code ?? "error"}: ${e.message ?? JSON.stringify(e)}`;
    };
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        handle(buf.slice(0, nl));
        buf = buf.slice(nl + 1);
      }
    }
    handle(buf);
    if (failure) throw new SailError(`Sail exec failed: ${failure}`);
    return { stdout: Buffer.concat(out).toString("utf8"), stderr: Buffer.concat(err).toString("utf8"), code };
  },

  async writeFile(id: string, path: string, data: string | Buffer, mode = 0o755) {
    const res = await fetch(`${BOX_API}/sailboxes/${id}/files?path=${encodeURIComponent(path)}&mode=${mode}`, {
      method: "PUT",
      headers: headers({ "Content-Type": "application/octet-stream" }),
      body: typeof data === "string" ? data : new Uint8Array(data),
    });
    if (!res.ok) throw new SailError(`Sail write ${path} -> ${res.status}`, res.status);
  },

  async readFile(id: string, path: string): Promise<Buffer> {
    const res = await fetch(`${BOX_API}/sailboxes/${id}/files?path=${encodeURIComponent(path)}`, {
      headers: headers(),
      cache: "no-store",
    });
    if (!res.ok) throw new SailError(`Sail read ${path} -> ${res.status}`, res.status);
    return Buffer.from(await res.arrayBuffer());
  },
};
