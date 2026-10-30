"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import type { Run, RunEvent, StreamMessage } from "@/lib/types";

export interface Frame {
  image: string;
  url: string;
  title: string;
}

export function useRun(runId: string | null) {
  const [run, setRun] = useState<Run>();
  const [frame, setFrame] = useState<Frame>();
  const [error, setError] = useState<string>();
  const lastId = useRef(0);
  const loaded = useRef<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!runId) return;
    let es: EventSource | undefined;
    let cancelled = false;
    if (loaded.current !== runId) {
      loaded.current = runId;
      lastId.current = 0;
      setRun(undefined);
      setFrame(undefined);
      setError(undefined);
    }

    const upsert = (e: RunEvent) =>
      setRun((r) => {
        if (!r) return r;
        const i = r.events.findIndex((x) => x.id === e.id);
        const events = i < 0 ? [...r.events, e] : r.events.map((x) => (x.id === e.id ? e : x));
        return { ...r, events };
      });

    api
      .run(runId)
      .then((r) => {
        if (cancelled) return;
        setRun(r);
        if (r.frame) setFrame(r.frame);
        lastId.current = r.events[r.events.length - 1]?.id ?? 0;
        if (!["starting", "running", "waiting"].includes(r.status)) return;
        es = new EventSource(`/api/runs/${runId}/stream?after=${lastId.current}`);
        es.onmessage = (m) => {
          const msg = JSON.parse(m.data) as StreamMessage;
          if (msg.type === "event" || msg.type === "event-update") upsert(msg.event);
          else if (msg.type === "run") setRun((r) => (r ? { ...r, ...msg.run, events: r.events } : r));
          else if (msg.type === "frame") setFrame({ image: msg.image, url: msg.url, title: msg.title });
        };
      })
      .catch((e: Error) => !cancelled && setError(e.message));

    return () => {
      cancelled = true;
      es?.close();
    };
  }, [runId, nonce]);

  useEffect(() => {
    if (!run || !runId) return;
    if (["done", "failed", "stopped"].includes(run.status)) return;
    // Recover if the stream drops (dev server reloads, sleeping laptop).
    const t = setInterval(() => {
      api
        .run(runId)
        .then((r) => setRun((cur) => (cur && cur.events.length > r.events.length ? cur : r)))
        .catch(() => undefined);
    }, 15000);
    return () => clearInterval(t);
  }, [run?.status, runId]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Reconnect after a finished chat was resumed by a new message. */
  const reload = () => setNonce((n) => n + 1);

  return { run, frame, error, reload };
}
