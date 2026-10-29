"use client";

import { ArrowUp, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cx } from "../ui";

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

  return (
    <div
      className={cx(
        "flex items-end gap-2 rounded-[22px] bg-white p-2 pl-4 shadow-[0_0_0_1px_rgba(24,24,27,0.07),0_8px_24px_-12px_rgba(24,24,27,0.18)] transition-shadow focus-within:shadow-[0_0_0_1px_rgba(24,24,27,0.18),0_8px_28px_-12px_rgba(24,24,27,0.25)]"
      )}
    >
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
          "scroll-thin flex-1 resize-none bg-transparent py-2 leading-relaxed text-zinc-900 outline-none placeholder:text-zinc-400",
          large ? "min-h-[64px] text-[15px]" : "text-[14px]"
        )}
      />
      {busy && onStop && !value.trim() ? (
        <button
          onClick={onStop}
          title="Stop"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white transition-colors hover:bg-zinc-700"
        >
          <Square className="size-3.5 fill-current" />
        </button>
      ) : (
        <button
          onClick={() => void submit()}
          disabled={!value.trim() || sending}
          title="Send"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white transition-colors hover:bg-zinc-700 disabled:bg-zinc-200 disabled:text-zinc-400"
        >
          <ArrowUp className="size-4" />
        </button>
      )}
    </div>
  );
}
