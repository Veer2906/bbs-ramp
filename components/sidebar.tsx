"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ago } from "@/lib/client/api";
import { Icon, type IconName } from "./icon";
import { Spinner, cx } from "./ui";
import { useWorkspace } from "./workspace-provider";

export function Sidebar() {
  return (
    <aside className="flex w-[252px] shrink-0 flex-col px-3 pt-4 pb-3 text-zinc-600" style={{ viewTransitionName: "app-sidebar" }}>
      <Suspense fallback={<div className="flex-1" />}>
        <SidebarInner />
      </Suspense>
    </aside>
  );
}

function NavLink({ href, active, label, icon, count }: { href: string; active: boolean; label: string; icon: IconName; count?: number }) {
  return (
    <Link
      href={href}
      className={cx("press flex h-9 items-center gap-3 rounded-[10px] px-3 text-[13.5px]", active ? "bg-zinc-900/[0.09] text-zinc-900" : "hover:bg-zinc-900/[0.05] hover:text-zinc-900")}
    >
      <Icon name={icon} className={active ? "text-zinc-900" : "text-zinc-500"} />
      <span className="flex-1">{label}</span>
      {count ? <span className="tabular rounded-full bg-zinc-900/[0.09] px-2 py-px text-[11.5px] text-zinc-700">{count}</span> : null}
    </Link>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mt-6 mb-1.5 px-3 text-[12px] text-zinc-400">{children}</p>;
}

function SidebarInner() {
  const path = usePathname();
  const params = useSearchParams();
  const { runs, data } = useWorkspace();
  const currentRun = path === "/" ? params.get("run") : null;
  const openIssues = data.issues.filter((i) => i.status === "open").length;
  const review = data.documents.filter((d) => d.status === "needs_review").length;
  const home = path === "/" && !currentRun;

  return (
    <>
      <Link href="/" className="mb-4 flex h-8 items-center px-3 text-zinc-900" aria-label="Team Rampresso, home">
        <span className="display text-[23px]">Team Rampresso</span>
      </Link>

      <Link
        href="/"
        className={cx("press flex h-10 items-center gap-3 rounded-[10px] px-3 text-[13.5px] font-medium text-zinc-900", home ? "bg-zinc-900/[0.11]" : "bg-zinc-900/[0.05] hover:bg-zinc-900/[0.09]")}
      >
        <Icon name="compose" />
        New chat
      </Link>

      <Label>Close</Label>
      <nav className="flex flex-col gap-0.5">
        <NavLink href="/documents" active={path === "/documents"} label="Documents" icon="doc" count={review || undefined} />
        <NavLink href="/ledger" active={path === "/ledger"} label="Reconciliation" icon="ledger" />
        <NavLink href="/issues" active={path === "/issues"} label="Issues" icon="flag" count={openIssues || undefined} />
      </nav>

      <Label>Agent</Label>
      <nav className="flex flex-col gap-0.5">
        <NavLink href="/vault" active={path === "/vault"} label="Vault" icon="lock" />
        <NavLink href="/memory" active={path === "/memory"} label="Memory" icon="memory" />
      </nav>

      <Label>Recent</Label>
      <div className="scroll-thin -mx-1 flex-1 overflow-y-auto px-1">
        {runs.length === 0 ? <p className="px-3 py-1 text-[12.5px] text-zinc-400">No chats yet</p> : null}
        {runs.map((r) => {
          const live = ["starting", "running", "waiting"].includes(r.status);
          const on = currentRun === r.id;
          return (
            <Link key={r.id} href={`/?run=${r.id}`} className={cx("press flex flex-col rounded-[10px] px-3 py-2", on ? "bg-zinc-900/[0.09]" : "hover:bg-zinc-900/[0.05]")}>
              <span className={cx("truncate text-[13.5px]", on ? "text-zinc-900" : "text-zinc-700")}>{r.title}</span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-zinc-400">
                {live ? <Spinner className={cx("text-[10px]", r.status === "waiting" ? "text-amber-500" : "text-emerald-500")} /> : null}
                {r.status === "waiting" ? (
                  <span className="text-amber-600">Needs your input</span>
                ) : r.status === "failed" ? (
                  <span className="text-rose-600">Failed</span>
                ) : r.status === "stopped" ? (
                  <span>Stopped</span>
                ) : live ? (
                  <span className="text-emerald-600">Working</span>
                ) : (
                  <span>{ago(r.updatedAt)}</span>
                )}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="mt-2">
        <NavLink href="/settings" active={path === "/settings"} label="Settings" icon="sliders" />
      </div>
    </>
  );
}
