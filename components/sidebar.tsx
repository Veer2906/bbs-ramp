"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AlertTriangle, FileText, KeyRound, Loader2, BookOpen, Plus, Settings2 } from "lucide-react";
import { ago } from "@/lib/client/api";
import { cx } from "./ui";
import { useWorkspace } from "./workspace-provider";

export function Sidebar() {
  return (
    <aside className="flex w-[260px] shrink-0 flex-col bg-[#efefec] px-3 pt-4 pb-3">
      <Suspense fallback={<div className="flex-1" />}>
        <SidebarInner />
      </Suspense>
    </aside>
  );
}

function SidebarInner() {
  const path = usePathname();
  const params = useSearchParams();
  const { runs, data } = useWorkspace();
  const currentRun = path === "/" ? params.get("run") : null;
  const openIssues = data.issues.filter((i) => i.status === "open").length;
  const review = data.documents.filter((d) => d.status === "needs_review").length;

  const nav = [
    { href: "/documents", label: "Documents", icon: FileText, count: review || undefined },
    { href: "/ledger", label: "Reconciliation", icon: BookOpen },
    { href: "/issues", label: "Issues", icon: AlertTriangle, count: openIssues || undefined },
    { href: "/vault", label: "Vault", icon: KeyRound },
  ];

  return (
    <>
      <Link
        href="/"
        className={cx(
          "flex h-10 items-center gap-2 rounded-xl px-3 text-[13.5px] font-medium transition-colors",
          path === "/" && !currentRun ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-700 hover:bg-zinc-900/5"
        )}
      >
        <Plus className="size-4" />
        New task
      </Link>

      <nav className="mt-3 flex flex-col gap-0.5">
        {nav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={cx(
              "flex h-9 items-center gap-2.5 rounded-xl px-3 text-[13.5px] transition-colors",
              path === n.href ? "bg-white font-medium text-zinc-900 shadow-sm" : "text-zinc-600 hover:bg-zinc-900/5 hover:text-zinc-900"
            )}
          >
            <n.icon className="size-4 opacity-70" />
            <span className="flex-1">{n.label}</span>
            {n.count ? <span className="tabular text-[12px] text-zinc-500">{n.count}</span> : null}
          </Link>
        ))}
      </nav>

      <p className="mt-7 mb-1.5 px-3 text-[11.5px] font-medium tracking-wide text-zinc-400 uppercase">Tasks</p>
      <div className="scroll-thin -mx-1 flex-1 overflow-y-auto px-1">
        {runs.length === 0 ? <p className="px-3 py-2 text-[13px] text-zinc-400">No tasks yet</p> : null}
        {runs.map((r) => {
          const live = ["starting", "running", "waiting"].includes(r.status);
          return (
            <Link
              key={r.id}
              href={`/?run=${r.id}`}
              className={cx(
                "group flex flex-col rounded-xl px-3 py-2 transition-colors",
                currentRun === r.id ? "bg-white shadow-sm" : "hover:bg-zinc-900/5"
              )}
            >
              <span className={cx("line-clamp-2 text-[13px] leading-snug", currentRun === r.id ? "text-zinc-900" : "text-zinc-700")}>{r.title}</span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-zinc-400">
                {live ? <Loader2 className="size-3 animate-spin text-zinc-500" /> : null}
                {r.status === "waiting" ? (
                  <span className="text-amber-700">Needs your input</span>
                ) : r.status === "failed" ? (
                  <span className="text-rose-600">Failed</span>
                ) : r.status === "stopped" ? (
                  <span>Stopped</span>
                ) : live ? (
                  <span className="text-zinc-500">Working</span>
                ) : (
                  <span>{ago(r.updatedAt)}</span>
                )}
              </span>
            </Link>
          );
        })}
      </div>

      <Link
        href="/settings"
        className={cx(
          "mt-2 flex h-9 items-center gap-2.5 rounded-xl px-3 text-[13.5px] transition-colors",
          path === "/settings" ? "bg-white font-medium text-zinc-900 shadow-sm" : "text-zinc-600 hover:bg-zinc-900/5 hover:text-zinc-900"
        )}
      >
        <Settings2 className="size-4 opacity-70" />
        Settings
      </Link>
    </>
  );
}
