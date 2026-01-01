import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import { RpcClient, type RpcConfig } from "../lib/rpc";

type SettingsState = {
  rpcConfig: RpcConfig;
  feeTarget: number;
};

type SettingsContextValue = SettingsState & {
  client: RpcClient;
  update(config: Partial<SettingsState>): void;
};

const DEFAULT_STATE: SettingsState = {
  rpcConfig: {
    url: "http://109.104.154.151:8832/",
    timeoutMs: 15_000,
  },
  feeTarget: 6,
};

const STORAGE_KEY = "baseline-light:settings:v2";

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SettingsState>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    try {
      const parsed = JSON.parse(raw) as SettingsState;
      return {
        ...DEFAULT_STATE,
        ...parsed,
        rpcConfig: { ...DEFAULT_STATE.rpcConfig, ...(parsed.rpcConfig || {}) },
      };
    } catch {
      return DEFAULT_STATE;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const client = useMemo(() => new RpcClient(state.rpcConfig), [state.rpcConfig]);

  const value: SettingsContextValue = {
    ...state,
    client,
    update: (config) => setState((prev) => ({ ...prev, ...config, rpcConfig: { ...prev.rpcConfig, ...(config.rpcConfig || {}) } })),
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used inside SettingsProvider");
  }
  return ctx;
}
