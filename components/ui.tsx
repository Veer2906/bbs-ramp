"use client";

import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Icon } from "./icon";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/** Ring spinner sized by the surrounding font size. */
export function Spinner({ className }: { className?: string }) {
  return <span aria-hidden className={cx("spinner", className)} />;
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
        "press inline-flex items-center justify-center gap-1.5 rounded-[10px] font-medium whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40",
        size === "sm" ? "h-8 px-3 text-[13px]" : "h-9 px-3.5 text-[13.5px]",
        variant === "primary" && "bg-plaster text-ink hover:bg-white",
        variant === "secondary" && "bg-zinc-900/[0.08] text-zinc-900 hover:bg-zinc-900/[0.13]",
        variant === "ghost" && "text-zinc-600 hover:bg-zinc-900/[0.07] hover:text-zinc-900",
        variant === "danger" && "text-rose-600 hover:bg-rose-500/[0.12]",
        className
      )}
    >
      {loading ? <Spinner className="text-[12px]" /> : null}
      {children}
    </button>
  );
}

const TONES = {
  neutral: "bg-zinc-900/[0.08] text-zinc-700",
  green: "bg-emerald-500/[0.13] text-emerald-800",
  amber: "bg-amber-500/[0.14] text-amber-800",
  red: "bg-rose-500/[0.14] text-rose-800",
  blue: "bg-sky-500/[0.16] text-sky-700",
} as const;

export type Tone = keyof typeof TONES;

export function Pill({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex h-[22px] shrink-0 items-center rounded-full px-2.5 text-[11.5px] font-medium whitespace-nowrap", TONES[tone], className)}>{children}</span>
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("card", className)}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 px-8 pt-10 pb-7">
      <div className="min-w-0">
        <h1 className="display text-[40px] text-zinc-900">{title}</h1>
        {subtitle ? <p className="mt-3 max-w-[620px] text-[13.5px] leading-relaxed text-zinc-600">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <p className="display text-[24px] text-zinc-900">{title}</p>
      {hint ? <p className="mt-2 max-w-sm text-[13.5px] leading-relaxed text-zinc-500">{hint}</p> : null}
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
    <div className="inline-flex rounded-[10px] bg-zinc-900/[0.07] p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "press h-7 rounded-lg px-3 text-[12.5px] font-medium whitespace-nowrap",
            o.value === value ? "bg-zinc-900/[0.14] text-zinc-900 shadow-[inset_0_1px_0_rgb(244_241_234/0.08)]" : "text-zinc-500 hover:text-zinc-800"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Number that rolls each digit into place like a mechanical counter. Non-digits render as-is. */
export function Odometer({ value, className }: { value: string | number; className?: string }) {
  const text = String(value);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(r);
  }, []);
  return (
    <span className={cx("tabular inline-flex overflow-hidden leading-none", className)} aria-label={text}>
      {text.split("").map((c, i) => {
        const d = c.charCodeAt(0) - 48;
        if (d < 0 || d > 9) return <span key={i} aria-hidden className="whitespace-pre">{c}</span>;
        return (
          <span key={i} aria-hidden className="relative inline-block h-[1em] w-[0.5em] overflow-hidden">
            <span className="odo-digit absolute inset-x-0 top-0 flex flex-col items-center" style={{ transform: `translateY(-${(ready ? d : 0) * 10}%)`, transitionDelay: `${i * 60}ms` }}>
              {"0123456789".split("").map((n) => (
                <span key={n} className="h-[1em] leading-none">
                  {n}
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** Thin progress line that fills from the left. */
export function Meter({ value, className }: { value: number; className?: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(r);
  }, []);
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <span className={cx("block h-[3px] overflow-hidden rounded-full bg-zinc-900/[0.1]", className)} aria-hidden>
      <span className="block h-full rounded-full bg-plaster transition-[width] duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ width: `${ready ? pct : 0}%` }} />
    </span>
  );
}

/** Small close button used by drawers and panels. */
export function CloseButton({ onClick, title = "Close" }: { onClick: () => void; title?: string }) {
  return (
    <button onClick={onClick} title={title} className="press flex size-7 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-900/[0.08] hover:text-zinc-900">
      <Icon name="x" size={14} />
    </button>
  );
}

export const inputClass =
  "h-9 w-full rounded-[10px] bg-zinc-900/[0.06] px-3 text-[13.5px] text-zinc-900 shadow-[inset_0_0_0_1px_rgb(244_241_234/0.08)] outline-none transition-shadow placeholder:text-zinc-400 focus:shadow-[inset_0_0_0_1px_rgb(244_241_234/0.45),0_0_0_4px_rgb(244_241_234/0.08)]";
