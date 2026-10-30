"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "../ui";
import { Px } from "../pixel-icon";

export function Composer({
  placeholder,
  onSubmit,
  onStop,
  busy,
  autoFocus,
  large,
  value: controlled,
  onValueChange,
}: {
  placeholder: string;
  onSubmit: (text: string) => Promise<void> | void;
  onStop?: () => void;
  busy?: boolean;
  autoFocus?: boolean;
  large?: boolean;
  value?: string;
  onValueChange?: (v: string) => void;
}) {
  const [local, setLocal] = useState("");
  const value = controlled ?? local;
  const setValue = onValueChange ?? setLocal;
  const [sending, setSending] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [value]);

  const submit = async () => {
    const text = value.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await onSubmit(text);
      setValue("");
    } finally {
      setSending(false);
    }
  };

  const stop = busy && onStop && !value.trim();

  return (
    <div className="card flex flex-col gap-1 p-2 pl-4 transition-shadow focus-within:shadow-[0_0_0_1px_rgb(28_27_24/0.35),0_0_0_4px_rgb(228_242_34/0.35),0_12px_32px_-16px_rgb(28_27_24/0.3)]">
      <textarea
        ref={ref}
        rows={1}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void submit();
          }
        }}
        placeholder={placeholder}
        className={cx(
          "scroll-thin resize-none bg-transparent pt-2 leading-relaxed text-zinc-900 outline-none placeholder:text-zinc-400",
          large ? "min-h-[72px] text-[15.5px]" : "text-[14px]"
        )}
      />
      <div className="flex items-center gap-2">
        <span className="flex-1 font-mono text-[10.5px] tracking-wide text-zinc-400">
          {stop ? "agent running" : "↵ send   ⇧↵ new line"}
        </span>
        {stop ? (
          <button
            onClick={onStop}
            title="Stop"
            className="press flex h-8 items-center gap-2 rounded-lg bg-moss px-3 font-mono text-[11px] tracking-wider text-[#f1f4ec] uppercase hover:bg-moss-2"
          >
            <span className="size-2 bg-zinc-50" />
            Stop
          </button>
        ) : (
          <button
            onClick={() => void submit()}
            disabled={!value.trim() || sending}
            title="Send"
            className="press flex h-8 items-center gap-2 rounded-lg bg-moss px-3 font-mono text-[11px] tracking-wider text-lime uppercase hover:bg-lime hover:text-moss disabled:bg-zinc-900/[0.07] disabled:text-zinc-400"
          >
            {sending ? "Sending" : "Run"}
            <Px name="next" scale={1} />
          </button>
        )}
      </div>
    </div>
  );
}
