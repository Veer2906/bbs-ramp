"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, type DataPayload, type SettingsPayload } from "@/lib/client/api";
import type { RunSummary } from "@/lib/types";

interface Workspace {
  runs: RunSummary[];
  data: DataPayload;
  settings?: SettingsPayload;
  refreshRuns: () => Promise<void>;
  refreshData: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  setSettings: (s: SettingsPayload) => void;
}

const Ctx = createContext<Workspace | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [data, setData] = useState<DataPayload>({ documents: [], issues: [], ledger: [] });
  const [settings, setSettings] = useState<SettingsPayload>();

  const refreshRuns = useCallback(async () => setRuns(await api.runs().catch(() => [])), []);
  const refreshData = useCallback(async () => {
    const d = await api.data().catch(() => undefined);
    if (d) setData(d);
  }, []);
  const refreshSettings = useCallback(async () => {
    const s = await api.settings().catch(() => undefined);
    if (s) setSettings(s);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshRuns();
    void refreshSettings();
    const es = new EventSource("/api/data/stream");
    let timer: ReturnType<typeof setTimeout> | undefined;
    es.onmessage = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void refreshData(), 150);
    };
    return () => {
      clearTimeout(timer);
      es.close();
    };
  }, [refreshRuns, refreshData, refreshSettings]);

  const active = runs.some((r) => ["starting", "running", "waiting"].includes(r.status));
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => void refreshRuns(), 2500);
    return () => clearInterval(t);
  }, [active, refreshRuns]);

  const value = useMemo(
    () => ({ runs, data, settings, refreshRuns, refreshData, refreshSettings, setSettings }),
    [runs, data, settings, refreshRuns, refreshData, refreshSettings]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWorkspace outside provider");
  return v;
}
