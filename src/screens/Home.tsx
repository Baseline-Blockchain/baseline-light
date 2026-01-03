import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useSettings } from "../state/settings";
import { useWallet } from "../state/wallet";
import type { AddressBalance } from "../lib/rpc";
import { fromLiners } from "../lib/wallet";

const EXPLORER_TX = "https://explorer.baseline.cash/tx/";

type BalanceState = {
  data?: AddressBalance;
  loading: boolean;
  error?: string;
};

export function HomeScreen() {
  const { client } = useSettings();
  const { keys } = useWallet();
  const addresses = useMemo(() => keys.map((k) => k.address), [keys]);

  const [balance, setBalance] = useState<BalanceState>({ loading: false });
  const [txIds, setTxIds] = useState<any[]>([]);
  const lastHeight = useRef<number | null>(null);
  const lastBalance = useRef<AddressBalance | undefined>(undefined);

  const load = useCallback(
    async (opts?: { quiet?: boolean }) => {
      if (!addresses.length) return;
       const hasExisting = Boolean(lastBalance.current);
      if (!opts?.quiet) {
        setBalance((prev) => ({ ...prev, loading: hasExisting ? prev.loading : true, error: undefined }));
      }
      try {
        const [b, txids] = await Promise.all([
          client.getAddressBalance(addresses),
          client.getAddressTxids(addresses, true),
        ]);
        lastBalance.current = b;
        setBalance({ loading: false, data: b });
        setTxIds(Array.isArray(txids) ? txids.slice(-5).reverse() : []);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (opts?.quiet && lastBalance.current) {
          setBalance({ loading: false, data: lastBalance.current, error: undefined });
        } else if (lastBalance.current) {
          setBalance({ loading: false, data: lastBalance.current, error: message });
        } else {
          setBalance({ loading: false, error: message });
        }
      }
    },
    [addresses, client],
  );

  const checkHeight = useCallback(async () => {
    if (!addresses.length) return;
    try {
      const info = await client.getBlockchainInfo();
      if (typeof info.blocks === "number" && info.blocks !== lastHeight.current) {
        lastHeight.current = info.blocks;
        await load({ quiet: true });
      }
    } catch {
      // ignore height polling errors
    }
  }, [addresses.length, client, load]);

  useEffect(() => {
    lastHeight.current = null;
    void load();
    const onVis = () => {
      if (!document.hidden) {
        void load();
      }
    };
    const interval = setInterval(() => {
      void checkHeight();
    }, 20_000);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(interval);
    };
  }, [load, checkHeight]);

  const maturedLiners =
    balance.data?.matured_liners ?? (typeof balance.data?.balance_liners === "number" ? balance.data.balance_liners : 0);
  const immatureLiners =
    balance.data?.immature_liners ??
    Math.max(0, (typeof balance.data?.balance_liners === "number" ? balance.data.balance_liners : 0) - maturedLiners);
  const total = balance.data ? fromLiners(balance.data.balance_liners) : 0;
  const matured = fromLiners(maturedLiners);
  const immature = fromLiners(immatureLiners);

  const openExplorer = useCallback(async (txid: string) => {
    const url = `${EXPLORER_TX}${txid}`;
    const w = window as any;
    if (w && (w.__TAURI__ || w.__TAURI_IPC__ || w.__TAURI_INTERNALS__)) {
      try {
        const shell = await import("@tauri-apps/plugin-shell");
        await shell.open(url);
        return;
      } catch {
        // fall through to window open
      }
    }
    window.open(url, "_blank", "noreferrer");
  }, []);

  return (
    <div className="grid-2">
      <div className="card">
        {balance.loading && (
          <div className="balance-hero">
            <div className="skeleton skeleton-line" style={{ width: "45%" }} />
            <div className="skeleton skeleton-block" style={{ width: "65%", height: 30 }} />
            <div className="skeleton skeleton-line" style={{ width: "55%" }} />
          </div>
        )}
        {balance.error && <p style={{ color: "var(--danger)" }}>{balance.error}</p>}
        {balance.data && (
          <div className="balance-hero">
            <div className="balance-label">Spendable balance</div>
            <div className="balance-value">{matured.toFixed(8)}</div>
            <div className="balance-unit">BLINE</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6, lineHeight: 1.4 }}>
              <div>Immature: {immature.toFixed(8)} BLINE</div>
              <div>Total: {total.toFixed(8)} BLINE</div>
            </div>
          </div>
        )}
      </div>
      <div className="card" style={{ gridColumn: "1 / -1" }}>
        <h3>Addresses</h3>
        <p>These addresses are derived locally; generate more from Settings.</p>
        <div className="grid-2">
          {keys.map((k) => (
            <div key={k.address} className="address-chip">
              <div className="label">{k.path ?? "imported"}</div>
              <code style={{ wordBreak: "break-all" }}>{k.address}</code>
            </div>
          ))}
        </div>
      </div>
      <div className="card" style={{ gridColumn: "1 / -1" }}>
        <h3>Recent activity</h3>
        {balance.loading && (
          <div className="grid-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="address-chip">
                <div className="skeleton skeleton-line" style={{ width: "40%" }} />
                <div className="skeleton skeleton-line" style={{ width: "85%", marginTop: 8 }} />
              </div>
            ))}
          </div>
        )}
        {!balance.loading && txIds.length === 0 && <p>No recent transactions for these addresses.</p>}
        {!balance.loading && txIds.length > 0 && (
          <div className="grid-2">
            {txIds.map((tx: any, idx) => (
              <div key={idx} className="address-chip">
                <div className="label">Height {tx.height ?? "mempool"}</div>
                <button
                  type="button"
                  onClick={() => openExplorer(tx.txid ?? tx)}
                  style={{ color: "var(--accent)", background: "transparent", border: "none", padding: 0, textAlign: "left", cursor: "pointer" }}
                >
                  {tx.txid ?? tx}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
