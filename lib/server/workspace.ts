import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { env } from "./env";
import { sail, SailError } from "./sail";
import { store } from "./store";

const RUNTIME_FILES = ["browserd.py", "ctl.py", "portals.py", "bootstrap.sh"];
const STATE = "sailbox.json";

interface BoxState {
  sailboxId?: string;
  runtimeHash?: string;
}

export interface WorkspaceStatus {
  state: "idle" | "provisioning" | "ready" | "error";
  sailboxId?: string;
  message?: string;
}

export interface BrowserReply {
  ok: boolean;
  error?: string;
  url?: string;
  title?: string;
  tabs?: string[];
  text?: string;
  shot?: string;
  image?: string;
  downloads?: { name: string; path: string; size: number; url: string; error?: string }[];
  matches?: string[];
  files?: { name: string; path: string; size: number }[];
  [k: string]: unknown;
}

type G = { __ws?: { status: WorkspaceStatus; ready?: Promise<string>; hash?: string } };
const g = globalThis as G;
const ws = (g.__ws ??= { status: { state: "idle" } });

function runtime() {
  const dir = path.join(process.cwd(), "sailbox");
  const files = RUNTIME_FILES.map((f) => ({ name: f, data: fs.readFileSync(path.join(dir, f)) }));
  const hash = crypto.createHash("sha256");
  files.forEach((f) => hash.update(f.name).update(f.data));
  return { files, hash: hash.digest("hex").slice(0, 16) };
}

function setStatus(s: WorkspaceStatus) {
  ws.status = s;
}

async function provision(): Promise<string> {
  const state = await store.readState<BoxState>(STATE, {});
  let boxId = state.sailboxId;
  if (boxId) {
    try {
      const info = await sail.get(boxId);
      if (["terminated", "failed", "terminating"].includes(info.status)) boxId = undefined;
      else if (info.status === "paused") await sail.resume(boxId);
    } catch (e) {
      if (e instanceof SailError && e.status === 404) boxId = undefined;
      else throw e;
    }
  }
  if (!boxId) {
    setStatus({ state: "provisioning", message: "Creating a persistent Sailbox" });
    const app = await sail.findApp(env.sailApp());
    const info = await sail.create(app.id, "ledger-agent-browser", `ledger-agent-${Date.now()}`);
    if (info.status === "failed") throw new Error(`Sailbox failed to start: ${info.error_message ?? "unknown"}`);
    boxId = info.sailbox_id;
    await store.writeState(STATE, { sailboxId: boxId });
  }
  const rt = runtime();
  const current = await store.readState<BoxState>(STATE, {});
  if (current.runtimeHash !== rt.hash) {
    setStatus({ state: "provisioning", sailboxId: boxId, message: "Installing browser runtime (first run takes about a minute)" });
    await Promise.all(rt.files.map((f) => sail.writeFile(boxId!, `/opt/agent/${f.name}`, f.data)));
    const r = await sail.exec(boxId, "bash /opt/agent/bootstrap.sh", 900);
    if (!r.stdout.includes("READY")) throw new Error(`Sailbox bootstrap failed: ${(r.stdout + r.stderr).slice(-600)}`);
    await store.writeState(STATE, { sailboxId: boxId, runtimeHash: rt.hash });
  } else {
    const ping = await rawAction(boxId, { action: "ping" }, 10);
    if (!ping.ok) {
      setStatus({ state: "provisioning", sailboxId: boxId, message: "Restarting browser" });
      const r = await sail.exec(boxId, "/opt/agent/restart.sh", 120);
      if (!r.stdout.includes("READY")) throw new Error(`Browser restart failed: ${r.stdout.slice(-400)}`);
    }
  }
  setStatus({ state: "ready", sailboxId: boxId });
  return boxId;
}

export function ensureWorkspace(): Promise<string> {
  // Re-provision when the runtime files change (e.g. after pulling a new version).
  const hash = runtime().hash;
  if (ws.ready && ws.hash !== hash) ws.ready = undefined;
  ws.hash = hash;
  if (!ws.ready) {
    ws.ready = provision().catch((e) => {
      ws.ready = undefined;
      setStatus({ state: "error", message: e instanceof Error ? e.message : String(e) });
      throw e;
    });
  }
  return ws.ready;
}

export function workspaceStatus(): WorkspaceStatus {
  return ws.status;
}

export async function savedWorkspace(): Promise<WorkspaceStatus> {
  if (ws.status.state !== "idle") return ws.status;
  const s = await store.readState<BoxState>(STATE, {}).catch(() => ({}) as BoxState);
  return { state: "idle", sailboxId: s.sailboxId };
}

async function rawAction(boxId: string, action: Record<string, unknown>, timeout = 60): Promise<BrowserReply> {
  const b64 = Buffer.from(JSON.stringify({ ...action, timeout })).toString("base64");
  const r = await sail.exec(boxId, `/opt/agent/venv/bin/python /opt/agent/ctl.py ${b64}`, timeout + 30);
  try {
    return JSON.parse(r.stdout) as BrowserReply;
  } catch {
    return { ok: false, error: `bad reply from browser: ${(r.stdout + r.stderr).slice(0, 300)}`, daemon_down: true };
  }
}

export async function browser(action: Record<string, unknown>, timeout = 60): Promise<BrowserReply> {
  const boxId = await ensureWorkspace();
  let reply = await rawAction(boxId, action, timeout);
  if (reply.daemon_down) {
    await sail.exec(boxId, "/opt/agent/restart.sh", 120);
    reply = await rawAction(boxId, action, timeout);
  }
  return reply;
}

export async function readBoxFile(sailPath: string): Promise<Buffer> {
  const boxId = await ensureWorkspace();
  return sail.readFile(boxId, sailPath);
}

export async function resetBrowser() {
  await browser({ action: "reset", shot: false }).catch(() => undefined);
}
