"use client";

import { useEffect, useState } from "react";
import { api, brief } from "@/lib/client/api";
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
    <div className="card rise mx-6 mt-4 !rounded-[14px] px-4 py-3 text-[13px] leading-relaxed text-amber-800">
      <p className="font-medium">{s.kind === "supabase" ? `Supabase (${s.target}) is not ready` : "Storage is not available"}</p>
      <p className="line-clamp-2 text-amber-800/75">{brief(s.message)}</p>
    </div>
  );
}
