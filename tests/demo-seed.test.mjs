import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

// Let Node resolve the official react-server export; jiti does not inherit custom conditions.
const jiti = createJiti(import.meta.url, { alias: { "server-only": fileURLToPath(import.meta.resolve("server-only")) } });
const { seedDemo } = await jiti.import("../lib/server/demo-seed.ts");
const { DEMO_PORTALS, DEMO_LOGINS, DEMO_LEDGER, DEMO_VERSION, demoMemory } = await jiti.import("../lib/server/demo.ts");
const { unseal } = await jiti.import("../lib/server/crypto.ts");
process.env.VAULT_KEY = "test-only-demo-key-not-a-production-secret";

function backend(portals = DEMO_PORTALS) {
  const state = new Map([["seeded", true], ["settings", { portals, provider: "openai", openaiModel: "custom-model" }]]);
  const vault = new Map();
  const ledger = new Map();
  return {
    state, vaultRows: vault, ledgerRows: ledger,
    getState: async (k) => state.get(k),
    setState: async (k, v) => { state.set(k, v); },
    vault: async () => [...vault.values()],
    putVault: async (v) => { vault.set(v.id, v); },
    seedLedger: async (rows) => { for (const r of rows) if (!ledger.has(r.id)) ledger.set(r.id, r); },
  };
}

test("repairs an old seeded=true workspace with an empty vault; every password decrypts", async () => {
  const b = backend();
  await seedDemo(b);
  assert.equal(b.vaultRows.size, 3);
  for (const p of DEMO_PORTALS) {
    const entry = [...b.vaultRows.values()].find((v) => v.url === p.url);
    assert.equal(entry.username, DEMO_LOGINS.find((l) => l.portalId === p.id).username);
    assert.equal(unseal(entry.passwordCiphertext, entry.id), DEMO_LOGINS.find((l) => l.portalId === p.id).password);
  }
  assert.equal(b.ledgerRows.size, DEMO_LEDGER.length);
  const memory = b.state.get("memory");
  assert.equal(memory.length, demoMemory().length);
  assert.ok(memory.every((m) => m.links.every((id) => memory.some((n) => n.id === id))));
  assert.equal(b.state.get("demo_seed_version"), DEMO_VERSION);
});

test("partial failure retries without duplicates; the version is only saved after success", async () => {
  const b = backend();
  const write = b.putVault;
  let fail = true;
  b.putVault = async (v) => {
    if (b.vaultRows.size === 1 && fail) { fail = false; throw new Error("network interrupted"); }
    await write(v);
  };
  await assert.rejects(seedDemo(b), /network interrupted/);
  assert.equal(b.state.has("demo_seed_version"), false);
  const first = [...b.vaultRows.values()][0];
  await seedDemo(b);
  assert.equal(b.vaultRows.size, 3);
  assert.deepEqual(b.vaultRows.get(first.id), first);
});

test("deletion after seeding stays deleted until an explicit restore", async () => {
  const b = backend();
  await seedDemo(b);
  b.vaultRows.delete("vault_demo_acme");
  await seedDemo(b);
  assert.equal(b.vaultRows.size, 2);
  await seedDemo(b, true);
  await seedDemo(b, true);
  assert.equal(b.vaultRows.size, 3);
  assert.equal(b.ledgerRows.size, DEMO_LEDGER.length);
});

test("preserves custom records, modified ledger entries and model settings", async () => {
  const b = backend();
  b.vaultRows.set("custom", { id: "custom", name: "Live vendor", url: "https://vendor.example", passwordCiphertext: "unchanged" });
  b.ledgerRows.set("L-1001", { ...DEMO_LEDGER[0], amount: 999 });
  const customMemory = { id: "mem_custom", title: "My rule", links: [], detail: "Keep this" };
  b.state.set("memory", [customMemory]);
  await seedDemo(b, true);
  assert.equal(b.vaultRows.get("custom").passwordCiphertext, "unchanged");
  assert.equal(b.ledgerRows.get("L-1001").amount, 999);
  assert.ok(b.state.get("memory").includes(customMemory));
  assert.equal(b.state.get("settings").openaiModel, "custom-model");
});

test("never installs demo credentials on a real portal reusing a demo id", async () => {
  const real = { ...DEMO_PORTALS[0], url: "https://real-vendor.example/northwind/" };
  const b = backend([real]);
  await seedDemo(b);
  assert.equal(b.vaultRows.size, 0);
  assert.equal(b.ledgerRows.size, 0);
  await seedDemo(b, true);
  assert.ok(b.state.get("settings").portals.some((p) => p.url === real.url && p.id === real.id));
  assert.equal(b.vaultRows.size, 3);
  assert.ok([...b.vaultRows.values()].every((v) => v.url.startsWith("http://127.0.0.1:8080/")));
});

test("links new facts to a user's existing fact with the same title", async () => {
  const b = backend();
  const customClose = { ...demoMemory()[0], id: "my_close", detail: "Keep my deadline" };
  b.state.set("memory", [customClose]);
  await seedDemo(b, true);
  const memory = b.state.get("memory");
  assert.equal(memory.filter((m) => m.title === "Month-end close").length, 1);
  assert.equal(memory.find((m) => m.id === "my_close").detail, "Keep my deadline");
  assert.ok(memory.every((m) => m.links.every((id) => memory.some((n) => n.id === id))));
});
