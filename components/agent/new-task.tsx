"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { api, docTypeLabel, money } from "@/lib/client/api";
import { ledgerMonth, reconcile } from "@/lib/client/ledger";
import { Icon, type IconName } from "../icon";
import { Meter, Odometer, cx } from "../ui";
import { useWorkspace } from "../workspace-provider";
import { Composer } from "./composer";
import { ModelSwitch } from "./model-switch";

const noop = () => () => {};
const greeting = () => {
  const h = new Date().getHours();
  return h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};
const step = (i: number) => ({ "--i": i }) as CSSProperties;

export function NewTask() {
  const router = useRouter();
  const { settings, data, refreshRuns } = useWorkspace();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string>();
  const hello = useSyncExternalStore(noop, greeting, () => "Welcome back");

  useEffect(() => {
    // Wake the cloud computer while the user is typing so the first action is instant.
    api.warmWorkspace().catch(() => undefined);
  }, []);

  const s = settings?.settings;
  const providerReady = s ? s.available[s.provider] : true;
  const rows = reconcile(data);
  const count = (state: string) => rows.filter((r) => r.state === state).length;
  const supported = rows.length - count("missing");
  const month = ledgerMonth(data.ledger);
  const open = data.issues.filter((i) => i.status === "open").sort((a, b) => b.createdAt - a.createdAt);
  const docs = [...data.documents].sort((a, b) => b.createdAt - a.createdAt);
  const portals = s?.portals ?? [];

  const start = async (text: string) => {
    setError(undefined);
    try {
      const run = await api.start(text);
      await refreshRuns();
      router.push(`/?run=${run.id}`);
    } catch (e) {
      setError((e as Error).message);
      throw e;
    }
  };

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="@container mx-auto w-full max-w-[1120px] px-8 pt-[max(72px,11vh)] pb-10">
        <h1 className="arrive display text-[60px] text-zinc-950 [text-shadow:0_2px_36px_rgb(0_0_0/0.55)]">{hello}</h1>
        <p className="arrive mt-3 text-[15px] text-zinc-800 [text-shadow:0_1px_18px_rgb(0_0_0/0.7)]" style={step(1)}>
          {rows.length
            ? `${rows.length - count("matched")} of ${rows.length} ${month ?? "ledger"} lines still to close${open.length ? `, ${open.length} ${open.length === 1 ? "issue" : "issues"} waiting on you` : ""}`
            : "Import a ledger to start a close"}
        </p>

        <div className="arrive mt-7" style={step(2)}>
          <Composer large autoFocus value={value} onValueChange={setValue} placeholder="Ask for documents, a reconciliation, or the whole month-end close" onSubmit={start} tools={<ModelSwitch />} />
          {error ? <p className="mt-2 px-2 text-[12.5px] text-rose-600">{error}</p> : null}
          {s && !providerReady ? (
            <p className="mt-3 px-2 text-[12.5px] text-amber-700">
              No {s.provider === "bedrock" ? "AWS Bedrock credentials" : s.provider === "openai" ? "OpenAI API key" : "Anthropic API key"} found.{" "}
              <Link href="/settings" className="underline underline-offset-2">
                Open settings
              </Link>
            </p>
          ) : null}
        </div>

        <div className="mt-8 grid gap-3.5 @2xl:grid-cols-2 @4xl:grid-cols-3">
          <Card className="@4xl:col-span-2" style={step(3)} icon="flag" title="Waiting on you" footer={open.length > 5 ? <FootLink href="/issues">{open.length - 5} more</FootLink> : <FootLink href="/issues">Open issues</FootLink>}>
            {open.length === 0 ? <Quiet>Nothing needs a decision. Mismatches and missing documents show up here.</Quiet> : null}
            {open.slice(0, 5).map((i) => (
              <Link key={i.id} href="/issues" className="row flex items-baseline gap-2.5 rounded-lg px-2.5 py-[7px]">
                <span className="min-w-0 flex-1 truncate text-[14px] text-zinc-900">{i.title}</span>
                {i.severity === "high" ? <span className="shrink-0 text-[12.5px] text-rose-600">Urgent</span> : null}
              </Link>
            ))}
          </Card>

          <Card style={step(4)} icon="lock" title="Vendor portals" footer={<FootLink href="/vault">Open vault</FootLink>}>
            {portals.length === 0 ? <Quiet>Add a vendor portal in settings and the agent can sign in to it.</Quiet> : null}
            {portals.map((p) => (
              <Link key={p.id} href="/vault" className="row flex items-center gap-3 rounded-lg px-2.5 py-[7px]">
                <span className="min-w-0 flex-1 truncate text-[14.5px] text-zinc-900">{p.name}</span>
                <span className={cx("text-[12.5px]", p.vaultId ? "text-emerald-600" : "text-amber-600")}>{p.vaultId ? "Login saved" : "No login"}</span>
              </Link>
            ))}
          </Card>

          <Card style={step(5)} icon="ledger" title={month ? `${month} ledger` : "Ledger"} footer={<FootLink href="/ledger">Open reconciliation</FootLink>}>
            <div className="px-2.5 pt-1 pb-2">
              <p className="flex items-baseline gap-2">
                <Odometer value={String(supported).padStart(2, "0")} className="display text-[44px] text-zinc-950" />
                <span className="text-[13px] text-zinc-500">of {rows.length} lines have documents</span>
              </p>
              <Meter value={rows.length ? supported / rows.length : 0} className="mt-3" />
              <dl className="mt-3.5 grid grid-cols-3 gap-2 text-[12.5px]">
                <Stat label="Matched" value={count("matched")} />
                <Stat label="To review" value={count("review")} />
                <Stat label="No document" value={count("missing")} />
              </dl>
            </div>
          </Card>

          <Card className="@4xl:col-span-2" style={step(6)} icon="doc" title="Documents" footer={<FootLink href="/documents">{docs.length ? `All ${docs.length} documents` : "Open documents"}</FootLink>}>
            {docs.length === 0 ? <Quiet>Invoices, purchase orders and receipts land here as the agent retrieves them.</Quiet> : null}
            {docs.slice(0, 5).map((d) => (
              <Link key={d.id} href={`/documents?doc=${d.id}`} className="row flex items-baseline gap-2.5 rounded-lg px-2.5 py-[7px]">
                <span className="text-[14px] text-zinc-900">{d.number}</span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-zinc-500">{docTypeLabel[d.type]}</span>
                <span className="tabular text-[12.5px] text-zinc-600">{money(d.amount, d.currency)}</span>
              </Link>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({ icon, title, footer, className, style, children }: { icon: IconName; title: string; footer?: ReactNode; className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <section className={cx("arrive card flex flex-col p-2.5", className)} style={style}>
      <h2 className="flex items-center gap-2.5 px-2.5 pt-2 pb-2.5 text-[14px] font-medium text-zinc-800">
        <Icon name={icon} className="text-zinc-500" />
        {title}
      </h2>
      <div className="flex flex-1 flex-col">{children}</div>
      {footer ? <div className="px-2.5 pt-2 pb-1.5">{footer}</div> : null}
    </section>
  );
}

function FootLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-[13px] text-zinc-500 transition-colors hover:text-zinc-900">
      {children}
    </Link>
  );
}

function Quiet({ children }: { children: ReactNode }) {
  return <p className="flex-1 px-2.5 py-1 text-[13.5px] leading-relaxed text-zinc-500">{children}</p>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="tabular mt-0.5 text-[15px] text-zinc-900">{value}</dd>
    </div>
  );
}
