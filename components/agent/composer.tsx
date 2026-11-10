"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "../icon";
import { Spinner, cx } from "../ui";

export function Composer({
  placeholder,
  onSubmit,
  onStop,
  busy,
  autoFocus,
  large,
  value: controlled,
  onValueChange,
  tools,
}: {
  placeholder: string;
  onSubmit: (text: string) => Promise<void> | void;
  onStop?: () => void;
  busy?: boolean;
  autoFocus?: boolean;
  large?: boolean;
  value?: string;
  onValueChange?: (v: string) => void;
  tools?: ReactNode;
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
    el.style.height = `${Math.min(el.scrollHeight, 260)}px`;
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
    <div className="card flex flex-col gap-1 !rounded-[20px] !bg-[rgb(12_11_11/0.74)] p-2.5 pl-5 transition-shadow duration-200 focus-within:shadow-[inset_0_0_0_1px_rgb(244_241_234/0.22),0_0_0_5px_rgb(244_241_234/0.05),0_24px_48px_-32px_rgb(0_0_0/0.9)]">
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
          "scroll-thin resize-none bg-transparent pt-2.5 pr-2 leading-relaxed text-zinc-900 outline-none placeholder:text-zinc-600",
          large ? "min-h-[64px] text-[16px]" : "text-[14.5px]"
        )}
      />
      <div className="flex items-center gap-2">
        <div className="-ml-2">{tools}</div>
        <span className="flex-1" />
        {stop ? (
          <button onClick={onStop} title="Stop the agent" className="press flex h-9 items-center gap-1.5 rounded-full bg-zinc-900/[0.12] pr-3.5 pl-2.5 text-[13px] font-medium text-zinc-900 hover:bg-zinc-900/[0.18]">
            <Icon name="stop" />
            Stop
          </button>
        ) : (
          <button
            onClick={() => void submit()}
            disabled={!value.trim() || sending}
            title="Send"
            aria-label="Send"
            className="press flex size-9 items-center justify-center rounded-full bg-plaster text-ink hover:bg-white disabled:bg-zinc-900/[0.12] disabled:text-zinc-500"
          >
            {sending ? <Spinner className="text-[13px]" /> : <Icon name="arrowUp" size={18} />}
          </button>
        )}
      </div>
    </div>
  );
}
