"use client";

import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "secondary",
  size = "md",
  loading,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md"; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-[13px]" : "h-9 px-3.5 text-[13.5px]",
        variant === "primary" && "bg-zinc-900 text-white hover:bg-zinc-700",
        variant === "secondary" && "bg-white text-zinc-800 shadow-[0_0_0_1px_rgba(24,24,27,0.08)] hover:bg-zinc-50",
        variant === "ghost" && "text-zinc-600 hover:bg-zinc-900/5 hover:text-zinc-900",
        variant === "danger" && "text-rose-700 hover:bg-rose-50",
        className
      )}
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : null}
      {children}
    </button>
  );
}

const TONES = {
  neutral: "bg-zinc-900/[0.05] text-zinc-600",
  green: "bg-emerald-500/10 text-emerald-700",
  amber: "bg-amber-500/12 text-amber-800",
  red: "bg-rose-500/10 text-rose-700",
  blue: "bg-sky-500/10 text-sky-700",
} as const;

export type Tone = keyof typeof TONES;

export function Pill({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex h-6 shrink-0 items-center rounded-lg px-2 text-[12px] font-medium whitespace-nowrap", TONES[tone], className)}>
      {children}
    </span>
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-2xl bg-white shadow-[0_0_0_1px_rgba(24,24,27,0.05),0_1px_2px_rgba(24,24,27,0.04)]", className)}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 px-8 pt-8 pb-6">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-zinc-900">{title}</h1>
        {subtitle ? <p className="mt-1 text-[13.5px] text-zinc-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <p className="text-[15px] font-medium text-zinc-800">{title}</p>
      {hint ? <p className="mt-1 max-w-sm text-[13.5px] text-zinc-500">{hint}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-xl bg-zinc-900/[0.05] p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "h-7 rounded-[10px] px-3 text-[12.5px] font-medium transition-colors",
            o.value === value ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const inputClass =
  "h-9 w-full rounded-xl bg-white px-3 text-[13.5px] text-zinc-900 shadow-[0_0_0_1px_rgba(24,24,27,0.1)] outline-none transition-shadow placeholder:text-zinc-400 focus:shadow-[0_0_0_1px_rgba(24,24,27,0.35),0_0_0_4px_rgba(24,24,27,0.06)]";
