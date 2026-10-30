"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ago } from "@/lib/client/api";
import { PixelStairs, Px } from "./pixel-icon";
import { Spinner, cx } from "./ui";
import { useWorkspace } from "./workspace-provider";

export function Sidebar() {
  return (
    <aside className="flex w-[248px] shrink-0 flex-col bg-moss px-3 pt-4 pb-3 text-moss-ink">
      <Suspense fallback={<div className="flex-1" />}>
        <SidebarInner />
      </Suspense>
    </aside>
  );
}

function NavLink({ href, active, index, label, count }: { href: string; active: boolean; index: string; label: string; count?: number }) {
  return (
    <Link
      href={href}
      className={cx(
        "press group relative flex h-9 items-center gap-3 rounded-lg px-3 text-[13.5px]",
        active ? "bg-white/[0.07] font-medium text-white" : "text-moss-ink hover:bg-white/[0.045] hover:text-white"
      )}
    >
      <span className={cx("absolute top-2 bottom-2 left-0 w-[3px]  bg-lime transition-transform duration-200", active ? "scale-y-100" : "scale-y-0")} />
      <span className={cx("font-mono text-[10.5px] tracking-wider", active ? "text-lime" : "text-moss-dim")}>{index}</span>
      <span className="flex-1">{label}</span>
      {count ? <span className="rounded-none bg-lime px-1.5 py-px font-mono text-[10.5px] text-moss">{String(count).padStart(2, "0")}</span> : null}
    </Link>
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
    { href: "/documents", label: "Documents", count: review || undefined },
    { href: "/ledger", label: "Reconciliation" },
    { href: "/issues", label: "Issues", count: openIssues || undefined },
    { href: "/vault", label: "Vault" },
  ];

  return (
    <>
      <Link
        href="/"
        className={cx(
          "press group flex h-10 items-center gap-2.5 rounded-lg px-3 text-[13.5px] font-medium",
          path === "/" && !currentRun ? "bg-lime text-moss" : "bg-white/[0.07] text-[#eef2ea] hover:bg-lime hover:text-moss"
        )}
      >
        <Px name="plus" scale={1.5} />
        <span className="flex-1">New task</span>
        <Px name="next" scale={1} className="opacity-60 transition-transform group-hover:translate-x-0.5" />
      </Link>

      <nav className="mt-4 flex flex-col gap-0.5">
        {nav.map((n, i) => (
          <NavLink key={n.href} href={n.href} active={path === n.href} index={String(i + 1).padStart(2, "0")} label={n.label} count={n.count} />
        ))}
      </nav>

      <p className="eyebrow mt-8 mb-2 flex items-center px-3 !text-moss-dim">
        <span className="flex-1">Tasks</span>
        <span className="text-[#4a5c50]">[{String(runs.length).padStart(2, "0")}]</span>
      </p>
      <div className="scroll-thin -mx-1 flex-1 overflow-y-auto px-1">
        {runs.length === 0 ? <p className="px-3 py-2 font-mono text-[11.5px] text-moss-dim">no tasks yet</p> : null}
        {runs.map((r) => {
          const live = ["starting", "running", "waiting"].includes(r.status);
          return (
            <Link
              key={r.id}
              href={`/?run=${r.id}`}
              className={cx(
                "press group flex flex-col rounded-lg px-3 py-2",
                currentRun === r.id ? "bg-white/[0.07]" : "hover:bg-white/[0.045]"
              )}
            >
              <span className={cx("line-clamp-2 text-[13px] leading-snug", currentRun === r.id ? "text-white" : "text-moss-ink")}>{r.title}</span>
              <span className="mt-1 flex items-center gap-1.5 font-mono text-[10.5px] tracking-wide text-moss-dim uppercase">
                {live ? <Spinner className={r.status === "waiting" ? "text-[#e8b24a]" : "text-lime"} /> : null}
                {r.status === "waiting" ? (
                  <span className="text-[#e8b24a]">Needs input</span>
                ) : r.status === "failed" ? (
                  <span className="text-[#e58a74]">Failed</span>
                ) : r.status === "stopped" ? (
                  <span>Stopped</span>
                ) : live ? (
                  <span className="text-lime">Working</span>
                ) : (
                  <span>{ago(r.updatedAt)}</span>
                )}
              </span>
            </Link>
          );
        })}
      </div>

      <PixelStairs heights={[1, 2, 1, 3, 2, 4, 3, 5]} block={10} className="mt-3 mb-3 px-3 opacity-90" />
      <div>
        <NavLink href="/settings" active={path === "/settings"} index="//" label="Settings" />
      </div>
    </>
  );
}
