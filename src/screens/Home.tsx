import { Buffer } from "buffer";
import { payments } from "bitcoinjs-lib";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Clock, Copy, Globe } from "phosphor-react";
import { motion, AnimatePresence } from "framer-motion";

import { useSettings } from "../state/settings";
import { useWallet } from "../state/wallet";
import type { AddressBalance } from "../lib/rpc";
import { BASELINE_NETWORK } from "../lib/networks";
import { fromLiners } from "../lib/wallet";
import { Card } from "../components/ui/Card";
import { cn } from "../lib/utils";
import { Button } from "../components/ui/Button";

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

  const copyAddress = async (addr: string) => {
    await navigator.clipboard.writeText(addr);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 content-start">
      {/* Balance Card */}
      <Card className="lg:col-span-12 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-32 bg-accent/5 rounded-full blur-3xl group-hover:bg-accent/10 transition-colors" />

        {balance.loading && !balance.data ? (
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-white/10 w-24 rounded" />
            <div className="h-10 bg-white/10 w-48 rounded" />
            <div className="h-4 bg-white/10 w-32 rounded" />
          </div>
        ) : (
          <div className="relative z-10">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted mb-2">Spendable Balance</h3>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-4xl md:text-5xl font-extrabold text-white tracking-tight shadow-accent drop-shadow-[0_0_25px_rgba(71,194,255,0.2)]">
                {matured.toFixed(8)}
              </span>
              <span className="text-lg font-bold text-muted">BLINE</span>
            </div>

            <div className="flex gap-6 text-sm">
              <div className="flex flex-col">
                <span className="text-muted text-xs uppercase tracking-wider font-semibold">Immature</span>
                <span className="font-mono text-white/70">{immature.toFixed(8)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted text-xs uppercase tracking-wider font-semibold">Total</span>
                <span className="font-mono text-white/70">{total.toFixed(8)}</span>
              </div>
            </div>

            {balance.error && <p className="text-danger text-sm mt-4 font-medium">{balance.error}</p>}
          </div>
        )}
      </Card>

      {/* Activity Section */}
      <Card className="lg:col-span-7 flex flex-col">
        <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
          <Clock size={20} className="text-accent" weight="duotone" />
          Recent Activity
        </h3>

        <div className="flex-1 space-y-3">
          {activity.loading && !activity.items.length ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
            ))
          ) : !activity.loading && activity.items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted gap-2 py-12">
              <Globe size={48} weight="thin" className="opacity-50" />
              <p>No transactions found</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {activity.items.map((tx) => {
                const isIncoming = tx.netLiners > 0;
                const isOutgoing = tx.netLiners < 0;
                const amount = fromLiners(Math.abs(tx.netLiners)).toFixed(8);

                return (
                  <motion.div
                    key={tx.txid}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="p-4 rounded-xl bg-panel-strong/40 border border-white/5 hover:bg-white/5 transition-colors group cursor-pointer"
                    onClick={() => openExplorer(tx.txid)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-start gap-3 min-w-0 pr-4">
                        <div className={cn("p-2 rounded-lg shrink-0", isIncoming ? "bg-accent/10 text-accent" : isOutgoing ? "bg-danger/10 text-danger" : "bg-white/5 text-muted")}>
                          {isIncoming ? <ArrowDown weight="bold" /> : <ArrowUp weight="bold" />}
                        </div>
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <div className="font-bold text-sm leading-tight">
                            {isIncoming ? "Received" : isOutgoing ? "Sent" : "Activity"}
                          </div>
                          <div className="text-xs text-muted font-mono leading-tight">
                            {tx.height ? `Height ${tx.height}` : "Pending"}
                            {typeof tx.confirmations === "number" && tx.confirmations >= 0 && ` • ${tx.confirmations} confs`}
                          </div>
                          <div className="text-[10px] font-mono text-muted/60 truncate w-fit max-w-full mt-1 group-hover:text-accent transition-colors">
                            {tx.txid}
                          </div>
                        </div>
                      </div>
                      <div className={cn("text-right whitespace-nowrap shrink-0", isIncoming ? "text-accent" : isOutgoing ? "text-danger" : "text-muted")}>
                        <span className="font-bold font-mono tracking-tight text-sm">
                          {isIncoming ? "+" : isOutgoing ? "-" : ""}{amount}
                        </span>
                        <span className="text-[10px] font-bold ml-1.5 opacity-70">BLINE</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
          {activity.error && <p className="text-danger text-sm">{activity.error}</p>}
        </div>
      </Card>

      {/* Addresses Section */}
      <Card className="lg:col-span-5 h-fit">
        <h3 className="text-lg font-bold mb-4">My Addresses</h3>
        <div className="space-y-2">
          {keys.map((k) => (
            <div key={k.address} className="p-3 rounded-lg bg-panel-strong/30 border border-white/5 flex items-center justify-between group hover:bg-white/5 transition-colors">
              <div className="overflow-hidden">
                <div className="text-[10px] uppercase tracking-wider font-bold text-muted mb-0.5">{k.path ?? "Imported"}</div>
                <code className="text-xs text-white/80 font-mono truncate block relative pr-4">
                  {k.address.slice(0, 10)}...{k.address.slice(-10)}
                </code>
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" onClick={() => copyAddress(k.address)}>
                <Copy size={14} />
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
