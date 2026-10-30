"use client";

import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/** Braille spinner drawn in the mono font; frames are discrete like a stepper motor. */
export function Spinner({ className }: { className?: string }) {
  return <span aria-hidden className={cx("spin-ascii inline-block w-[1ch] shrink-0 text-center font-mono leading-none", className)} />;
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
        "press inline-flex items-center justify-center gap-1.5 rounded-lg font-medium disabled:cursor-not-allowed disabled:opacity-45",
        size === "sm" ? "h-8 px-3 text-[13px]" : "h-9 px-3.5 text-[13.5px]",
        variant === "primary" && "bg-moss text-[#f1f4ec] hover:bg-moss-2 [&:hover_.btn-arrow]:translate-x-0.5",
        variant === "secondary" && "bg-[#fffefb] text-zinc-800 shadow-[0_0_0_1px_rgb(28_27_24/0.1)] hover:shadow-[0_0_0_1px_rgb(28_27_24/0.22)]",
        variant === "ghost" && "text-zinc-600 hover:bg-zinc-900/[0.05] hover:text-zinc-900",
        variant === "danger" && "text-rose-700 hover:bg-rose-500/10",
        className
      )}
    >
      {loading ? <Spinner className="text-[13px]" /> : null}
      {children}
    </button>
  );
}

const TONES = {
  neutral: "bg-zinc-900/[0.055] text-zinc-600",
  green: "bg-emerald-500/[0.12] text-emerald-800",
  amber: "bg-amber-500/[0.14] text-amber-800",
  red: "bg-rose-500/[0.11] text-rose-700",
  blue: "bg-sky-500/[0.12] text-sky-700",
  lime: "bg-lime text-zinc-900",
} as const;

export type Tone = keyof typeof TONES;

export function Pill({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex h-[22px] shrink-0 items-center rounded-[5px] px-1.5 font-mono text-[10.5px] font-medium tracking-[0.06em] whitespace-nowrap uppercase",
        TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("card", className)}>{children}</div>;
}

const GLYPHS = "▚▞▙▟▛▜░▒#/\\<>";

/** Text that decodes from block glyphs into place, left to right, once on mount. */
export function Scramble({ text, className }: { text: string; className?: string }) {
  const [shown, setShown] = useState(text);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const total = 14;
    const t = setInterval(() => {
      frame++;
      const settled = Math.floor((frame / total) * text.length);
      setShown(
        text
          .split("")
          .map((c, i) => (i < settled || c === " " ? c : GLYPHS[(i * 7 + frame * 3) % GLYPHS.length]))
          .join("")
      );
      if (frame >= total) clearInterval(t);
    }, 32);
    return () => clearInterval(t);
  }, [text]);
  return <span className={className}>{shown}</span>;
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("eyebrow", className)}>{children}</p>;
}

export function PageHeader({ index, title, subtitle, actions }: { index?: string; title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 px-8 pt-9 pb-6">
      <div className="min-w-0">
        <p className="eyebrow">
          {index ? <span className="text-zinc-300">{`[${index}] `}</span> : null}
          <Scramble text={title} />
        </p>
        <h1 className="mt-2 font-serif text-[34px] leading-none font-normal tracking-[-0.02em] text-zinc-900">{title}</h1>
        {subtitle ? <p className="mt-2.5 max-w-[640px] text-[13.5px] leading-relaxed text-zinc-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <pre aria-hidden className="mb-4 font-mono text-[11px] leading-[1.25] text-zinc-300">{"[ ░░░░░░ ]\n[ ░░░░   ]\n[ ░░     ]"}</pre>
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
    <div className="inline-flex rounded-lg bg-zinc-900/[0.055] p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "press h-7 rounded-md px-3 text-[12.5px] font-medium",
            o.value === value ? "bg-[#fffefb] text-zinc-900 shadow-[0_1px_2px_rgb(28_27_24/0.1),0_0_0_1px_rgb(28_27_24/0.06)]" : "text-zinc-500 hover:text-zinc-800"
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
          <span key={i} aria-hidden className="relative inline-block h-[1em] w-[1ch] overflow-hidden">
            <span className="odo-digit absolute inset-x-0 top-0 flex flex-col" style={{ transform: `translateY(-${(ready ? d : 0) * 10}%)`, transitionDelay: `${i * 40}ms` }}>
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

/** Fixed-width text progress bar, e.g. ███████░░░░░ */
export function AsciiBar({ value, width = 20, className }: { value: number; width?: number; className?: string }) {
  const filled = Math.round(Math.max(0, Math.min(1, value)) * width);
  return (
    <span className={cx("font-mono tracking-[-0.05em]", className)} aria-hidden>
      <span className="text-zinc-900">{"█".repeat(filled)}</span>
      <span className="text-zinc-300">{"░".repeat(width - filled)}</span>
    </span>
  );
}

export const inputClass =
  "h-9 w-full rounded-lg bg-[#fffefb] px-3 text-[13.5px] text-zinc-900 shadow-[0_0_0_1px_rgb(28_27_24/0.11)] outline-none transition-shadow placeholder:text-zinc-400 focus:shadow-[0_0_0_1px_rgb(28_27_24/0.5),0_0_0_4px_rgb(228_242_34/0.45)]";
