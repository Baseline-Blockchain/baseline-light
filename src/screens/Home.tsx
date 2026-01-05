import { Buffer } from "buffer";
import { payments } from "bitcoinjs-lib";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useSettings } from "../state/settings";
import { useWallet } from "../state/wallet";
import type { AddressBalance } from "../lib/rpc";
import { BASELINE_NETWORK } from "../lib/networks";
import { fromLiners } from "../lib/wallet";

const EXPLORER_TX = "https://explorer.baseline.cash/tx/";

type BalanceState = {
  data?: AddressBalance;
  loading: boolean;
  error?: string;
};

type ActivityItem = {
  txid: string;
  height?: number;
  blockhash?: string | null;
  netLiners: number;
  confirmations?: number;
  time?: number;
};

export function HomeScreen() {
  const { client } = useSettings();
  const { keys } = useWallet();
  const addresses = useMemo(() => keys.map((k) => k.address), [keys]);
  const addressSet = useMemo(() => new Set(addresses), [addresses]);

  const [balance, setBalance] = useState<BalanceState>({ loading: false });
  const [activity, setActivity] = useState<{ loading: boolean; items: ActivityItem[]; error?: string }>({
    loading: false,
    items: [],
  });
  const lastHeight = useRef<number | null>(null);
  const lastBalance = useRef<AddressBalance | undefined>(undefined);
  const lastActivity = useRef<ActivityItem[]>([]);

  const decodeAddress = useCallback((scriptHex?: string | null) => {
    if (!scriptHex) return null;
    try {
      const res = payments.p2pkh({ output: Buffer.from(scriptHex, "hex"), network: BASELINE_NETWORK });
      return res.address ?? null;
    } catch {
      return null;
    }
  }, []);

  const buildActivity = useCallback(
    async (txList: any[]): Promise<ActivityItem[]> => {
      if (!txList.length || addressSet.size === 0) return [];
      const rawCache = new Map<string, any>();
      const fetchRaw = async (txid: string, blockhash?: string | null) => {
        if (rawCache.has(txid)) return rawCache.get(txid);
        const tx = await client.getRawTransaction(txid, true, blockhash ?? undefined);
        rawCache.set(txid, tx);
        return tx;
      };

      const items: ActivityItem[] = [];
      for (const entry of txList) {
        const txid = typeof entry === "string" ? entry : entry?.txid;
        if (!txid) continue;
        try {
          const tx = await fetchRaw(txid, entry?.blockhash);
          let outputsToMe = 0;
          for (const vout of tx?.vout ?? []) {
            const addr = decodeAddress(vout?.scriptPubKey);
            if (addr && addressSet.has(addr) && typeof vout?.value === "number") {
              outputsToMe += vout.value;
            }
          }
          let inputsFromMe = 0;
          for (const vin of tx?.vin ?? []) {
            if (!vin || typeof vin.vout !== "number" || !vin.txid || vin.txid === "0".repeat(64)) continue;
            const prevTx = await fetchRaw(vin.txid);
            const prevOut = prevTx?.vout?.find((out: any) => out?.n === vin.vout);
            if (!prevOut || typeof prevOut?.value !== "number") continue;
            const addr = decodeAddress(prevOut?.scriptPubKey);
            if (addr && addressSet.has(addr)) {
              inputsFromMe += prevOut.value;
            }
          }
          const net = outputsToMe - inputsFromMe;
          items.push({
            txid,
            height: entry?.height,
            blockhash: entry?.blockhash,
            netLiners: net,
            confirmations: tx?.confirmations,
            time: tx?.time,
          });
        } catch {
          items.push({
            txid,
            height: entry?.height,
            blockhash: entry?.blockhash,
            netLiners: 0,
          });
        }
      }
      return items;
    },
    [addressSet, client, decodeAddress],
  );

  const load = useCallback(
    async (opts?: { quiet?: boolean }) => {
      if (!addresses.length) return;
      const hasExisting = Boolean(lastBalance.current);
      const hasActivity = lastActivity.current.length > 0;
      if (!opts?.quiet) {
        setBalance((prev) => ({ ...prev, loading: hasExisting ? prev.loading : true, error: undefined }));
        setActivity((prev) => ({ ...prev, loading: hasActivity ? prev.loading : true, error: undefined }));
      }
      try {
        const [b, txids] = await Promise.all([
          client.getAddressBalance(addresses),
          client.getAddressTxids(addresses, true),
        ]);
        const txList = Array.isArray(txids) ? txids.slice(0, 5) : [];
        const activityItems = await buildActivity(txList);
        lastBalance.current = b;
        lastActivity.current = activityItems;
        setBalance({ loading: false, data: b });
        setActivity({ loading: false, items: activityItems });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (opts?.quiet && lastBalance.current) {
          setBalance({ loading: false, data: lastBalance.current, error: undefined });
          setActivity({ loading: false, items: lastActivity.current, error: undefined });
        } else if (lastBalance.current) {
          setBalance({ loading: false, data: lastBalance.current, error: message });
          setActivity({ loading: false, items: lastActivity.current, error: undefined });
        } else {
          setBalance({ loading: false, error: message });
          setActivity({ loading: false, items: [], error: message });
        }
      }
    },
    [addresses, buildActivity, client],
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
        {activity.loading && (
          <div className="grid-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="address-chip">
                <div className="skeleton skeleton-line" style={{ width: "40%" }} />
                <div className="skeleton skeleton-line" style={{ width: "85%", marginTop: 8 }} />
              </div>
            ))}
          </div>
        )}
        {!activity.loading && activity.error && <p style={{ color: "var(--danger)" }}>{activity.error}</p>}
        {!activity.loading && activity.items.length === 0 && !activity.error && (
          <p>No recent transactions for these addresses.</p>
        )}
        {!activity.loading && activity.items.length > 0 && (
          <div className="grid-2">
            {activity.items.map((tx) => {
              const isIncoming = tx.netLiners > 0;
              const isOutgoing = tx.netLiners < 0;
              const label = isIncoming ? "Received" : isOutgoing ? "Sent" : "Activity";
              const amount = fromLiners(Math.abs(tx.netLiners)).toFixed(8);
              const color = isIncoming ? "var(--accent-strong)" : isOutgoing ? "var(--danger)" : "var(--muted)";
              const statusLabel = tx.height ? `Height ${tx.height}` : "Pending";
              const confirmationLabel =
                typeof tx.confirmations === "number" && tx.confirmations >= 0 ? ` | ${tx.confirmations} conf` : "";
              return (
                <div
                  key={tx.txid}
                  className="address-chip"
                  style={{ display: "grid", gap: 8, alignContent: "start" }}
                >
                  <div className="label">
                    {statusLabel}
                    {confirmationLabel}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      gap: 12,
                      marginTop: 6,
                    }}
                  >
                    <div style={{ color, fontWeight: 700 }}>{label}</div>
                    {tx.netLiners !== 0 ? (
                      <div style={{ color, fontWeight: 800, fontSize: 15 }}>
                        {isIncoming ? "+" : "-"}
                        {amount} BLINE
                      </div>
                    ) : (
                      <div style={{ color: "var(--muted)" }}>No net change</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => openExplorer(tx.txid)}
                    style={{
                      color: "var(--accent)",
                      background: "transparent",
                      border: "none",
                      padding: 0,
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    {tx.txid}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
