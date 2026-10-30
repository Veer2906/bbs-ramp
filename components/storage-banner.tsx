"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import type { StorageStatus } from "@/lib/types";

/** Shown only when the configured storage (e.g. Supabase) can't be used yet. */
export function StorageBanner() {
  const [s, setS] = useState<StorageStatus>();
  useEffect(() => {
    let stop = false;
    const check = () =>
      api
        .storage()
        .then((x) => !stop && setS(x))
        .catch(() => undefined);
    void check();
    const t = setInterval(check, 15000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);
  if (!s || s.ok) return null;
  return (
    <div className="mx-6 mt-4 rounded-none bg-amber-500/[0.09] px-4 py-3 text-[13px] leading-relaxed text-amber-900">
      <p className="font-medium">{s.kind === "supabase" ? `Supabase (${s.target}) is not ready` : "Storage is not available"}</p>
      <p className="text-amber-800">{s.message}</p>
    </div>
  );
}
