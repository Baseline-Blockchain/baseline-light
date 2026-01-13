import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Info, RocketLaunch, Warning, X } from "phosphor-react";
import { motion, AnimatePresence } from "framer-motion";

import { useSettings } from "../state/settings";
import { useWallet } from "../state/wallet";
import { buildAndSignTx, selectUtxos, type SpendableUtxo } from "../lib/tx";
import { fromLiners, toLiners } from "../lib/wallet";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select, type SelectOption } from "../components/ui/Select";
import { cn } from "../lib/utils";

const MIN_RELAY_FEE_RATE_LINERS_PER_KB = 5_000;
type FeeMode = "auto" | "custom";

const FEE_PRESETS = [
  { key: "standard", label: "Standard", multiplier: 1, hint: "Balanced" },
  { key: "fast", label: "Fast", multiplier: 1.3, hint: "Priority" },
  { key: "turbo", label: "Turbo", multiplier: 1.6, hint: "Top block" },
] as const;

type PendingSend = {
  build: {
    hex: string;
    fee: number;
    vsize: number;
  };
  amount: number;
  toAddress: string;
  feeRateLinersPerKb: number;
  feeTarget: number;
  feeMode: FeeMode;
  feePriorityLabel: string;
  feeMultiplier: number;
  baseFeeRateLinersPerKb: number | null;
  customFeeRatePerVb?: number;
};

type LastSend = {
  txid: string;
  amount: number;
  fee: number;
  vsize: number;
  feeRateLinersPerKb: number;
  feeTarget: number;
  feeMode: FeeMode;
  feePriorityLabel: string;
  feeMultiplier: number;
  baseFeeRateLinersPerKb: number | null;
  customFeeRatePerVb?: number;
};

type AddressStats = {
  totalLiners: number;
  maturedLiners: number;
};

const EXPLORER_TX = "https://explorer.baseline.cash/tx/";

export function SendScreen() {
  const { client, feeTarget } = useSettings();
  const { keys, keyRing } = useWallet();
  const defaultChange = keys[0]?.address ?? "";

  const [dest, setDest] = useState("");
  const [amount, setAmount] = useState("");
  const [fromAddress, setFromAddress] = useState("");
  const [changeAddress, setChangeAddress] = useState(defaultChange);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [feeRate, setFeeRate] = useState<number | null>(null);
  const [feeLoading, setFeeLoading] = useState(false);
  const [feeNote, setFeeNote] = useState<string | null>(null);
  const [feeMode, setFeeMode] = useState<FeeMode>("auto");
  const [feePresetKey, setFeePresetKey] = useState<(typeof FEE_PRESETS)[number]["key"]>("standard");
  const [customFeeRate, setCustomFeeRate] = useState("");
  const [building, setBuilding] = useState(false);
  const [pendingSend, setPendingSend] = useState<PendingSend | null>(null);
  const [sending, setSending] = useState(false);
  const [lastSend, setLastSend] = useState<LastSend | null>(null);
  const [pendingMempool, setPendingMempool] = useState<{ txid: string; confirmations: number } | null>(null);
  const [showPendingBanner, setShowPendingBanner] = useState(false);
  const [addressStats, setAddressStats] = useState<Record<string, AddressStats>>({});
  const [addressStatsLoading, setAddressStatsLoading] = useState(false);
  const [addressStatsError, setAddressStatsError] = useState<string | null>(null);
  const addresses = useMemo(() => keys.map((k) => k.address), [keys]);

  const collectUtxosForSpend = useCallback(
    async (addrList: string[], amountLiners: number, feeRateLinersPerKb: number) => {
      const pageSize = 500;
      let offset = 0;
      let all: SpendableUtxo[] = [];
      while (true) {
        const batch = await client.getAddressUtxos(addrList, pageSize, offset);
        all = all.concat(
          batch.map((u) => ({
            txid: u.txid,
            vout: u.outputIndex,
            value: u.liners,
            scriptPubKey: u.script,
            address: u.address,
          })),
        );
        try {
          selectUtxos(all, amountLiners, feeRateLinersPerKb);
          return all;
        } catch (err) {
          const msg = err instanceof Error ? err.message : "";
          if (msg.includes("Insufficient funds for amount") && batch.length === pageSize) {
            offset += pageSize;
            continue;
          }
          throw err;
        }
      }
    },
    [client],
  );

  const resetPending = () => {
    setPendingSend(null);
  };

  const fallbackFeeRate = 5_000;

  const selectedPreset = useMemo(
    () => FEE_PRESETS.find((p) => p.key === feePresetKey) ?? FEE_PRESETS[0],
    [feePresetKey],
  );

  const parsedCustomRateLinersPerKb = useMemo(() => {
    const numeric = Number(customFeeRate);
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    return Math.round(numeric * 1000);
  }, [customFeeRate]);

  const baseEstimatedFeeRate = useMemo(
    () => (typeof feeRate === "number" && Number.isFinite(feeRate) ? feeRate : null),
    [feeRate],
  );

  const computeEffectiveRate = useCallback(
    (baseRate: number | null) => {
      let candidate: number | null = null;
      if (feeMode === "custom") {
        candidate = parsedCustomRateLinersPerKb;
      } else {
        const base = baseRate ?? fallbackFeeRate;
        candidate = Math.max(1, Math.round(base * selectedPreset.multiplier));
      }
      if (!candidate) {
        return { rate: null as number | null, clamped: false };
      }
      const finalRate = Math.max(MIN_RELAY_FEE_RATE_LINERS_PER_KB, candidate);
      return { rate: finalRate, clamped: finalRate !== candidate };
    },
    [feeMode, parsedCustomRateLinersPerKb, selectedPreset.multiplier],
  );

  const { rate: previewFeeRate, clamped: previewClamped } = useMemo(
    () => computeEffectiveRate(baseEstimatedFeeRate),
    [computeEffectiveRate, baseEstimatedFeeRate],
  );

  const scrollMainToTop = () => {
    const el = document.querySelector<HTMLElement>(".shell-main");
    if (el && typeof el.scrollTo === "function") {
      el.scrollTo({ top: 0, behavior: "smooth" });
    } else if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const previewFeeRatePerVb = previewFeeRate ? previewFeeRate / 1000 : null;
  const baseRateText =
    baseEstimatedFeeRate !== null
      ? `${(baseEstimatedFeeRate / 1000).toFixed(2)} liners/vB`
      : `${(fallbackFeeRate / 1000).toFixed(2)} liners/vB (fallback)`;

  useEffect(() => {
    async function fetchFee() {
      setFeeLoading(true);
      try {
        const est = await client.estimateSmartFee(feeTarget);
        if (est && typeof est.feerate === "number") {
          setFeeRate(est.feerate * 100_000_000); // convert to liners/kB
        } else {
          setFeeRate(null);
        }
        const errors = Array.isArray(est?.errors) ? est.errors.filter(Boolean) : [];
        if (errors.length > 0) {
          setFeeNote(`estimatesmartfee: ${errors.join(" ")}`);
        } else if (!est || typeof est.feerate !== "number") {
          setFeeNote("estimatesmartfee: no feerate returned; using fallback");
        } else {
          setFeeNote(null);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setFeeNote(`estimatesmartfee failed: ${message}`);
        setFeeRate(null);
      } finally {
        setFeeLoading(false);
      }
    }
    fetchFee();
  }, [client, feeTarget]);

  useEffect(() => {
    let active = true;
    async function fetchAddressStats() {
      if (!addresses.length) {
        setAddressStats({});
        setAddressStatsError(null);
        setAddressStatsLoading(false);
        return;
      }
      setAddressStatsLoading(true);
      setAddressStatsError(null);
      try {
        const results = await Promise.all(
          addresses.map(async (addr) => {
            const bal = await client.getAddressBalance([addr]);
            const matured = bal.matured_liners ?? bal.balance_liners ?? 0;
            const total = bal.balance_liners ?? 0;
            return { addr, matured, total };
          }),
        );
        if (!active) return;
        const stats: Record<string, AddressStats> = {};
        results.forEach(({ addr, matured, total }) => {
          stats[addr] = { maturedLiners: matured, totalLiners: total };
        });
        setAddressStats(stats);
      } catch (err) {
        if (!active) return;
        const message = err instanceof Error ? err.message : String(err);
        setAddressStatsError(message);
        setAddressStats({});
      } finally {
        if (active) setAddressStatsLoading(false);
      }
    }
    fetchAddressStats();
    return () => {
      active = false;
    };
  }, [addresses, client]);

  useEffect(() => {
    if (!fromAddress) return;
    const stats = addressStats[fromAddress];
    if (stats && stats.maturedLiners <= 0) {
      setFromAddress("");
    }
  }, [addressStats, fromAddress]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setError(null);
    setErrorDetail(null);
    setLastSend(null);
    setPendingSend(null);
    setBuilding(false);
    if (!keyRing) {
      setError("Unlock wallet first");
      return;
    }
    if (!changeAddress && !defaultChange) {
      setError("No change address available");
      return;
    }
    const amountNum = Number(amount);
    if (!amountNum || amountNum <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (fromAddress) {
      const stats = addressStats[fromAddress];
      if (!stats || (stats.maturedLiners ?? 0) <= 0) {
        setError("Selected address has no spendable UTXOs");
        return;
      }
    }
    setBuilding(true);
    setStatus("Preparing review...");
    try {
      // ... (existing fee refresh logic)
      let liveRate = feeRate;
      try {
        const est = await client.estimateSmartFee(feeTarget);
        if (est && typeof est.feerate === "number") {
          liveRate = est.feerate * 100_000_000;
          setFeeRate(liveRate);
        }
      } catch { }

      const baseRate = typeof liveRate === "number" && Number.isFinite(liveRate) ? liveRate : null;
      const { rate, clamped } = computeEffectiveRate(baseRate);
      if (!rate) {
        setError("Enter a custom fee rate in liners/vB");
        setBuilding(false);
        return;
      }
      const queryAddresses = fromAddress ? [fromAddress] : addresses;
      const amountLiners = toLiners(amountNum);
      const utxos = await collectUtxosForSpend(queryAddresses, amountLiners, rate);
      const spendable: SpendableUtxo[] = utxos.filter((u) => keyRing[u.address]);
      if (!spendable.length) {
        setError("No spendable UTXOs for your addresses");
        setBuilding(false);
        return;
      }
      const build = buildAndSignTx(
        {
          utxos: spendable,
          toAddress: dest.trim(),
          amount: amountLiners,
          changeAddress: changeAddress || defaultChange,
          feeRateLinersPerKb: rate,
        },
        keyRing,
      );
      setPendingSend({
        build: {
          hex: build.hex,
          fee: build.fee,
          vsize: build.vsize,
        },
        amount: amountNum,
        toAddress: dest.trim(),
        feeRateLinersPerKb: rate,
        feeTarget,
        feeMode,
        feePriorityLabel: selectedPreset.label,
        feeMultiplier: selectedPreset.multiplier,
        baseFeeRateLinersPerKb: baseRate,
        customFeeRatePerVb: feeMode === "custom" && parsedCustomRateLinersPerKb ? parsedCustomRateLinersPerKb / 1000 : undefined,
      });
      setStatus("Review details below");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const detail = err instanceof Error && "code" in err ? `(${(err as any).code})` : "";
      setError(message);
      setErrorDetail(detail || null);
    } finally {
      setBuilding(false);
    }
  };

  const onConfirmSend = async () => {
    if (!pendingSend) return;
    setStatus(null);
    setError(null);
    setErrorDetail(null);
    setSending(true);
    try {
      const txidResult = await client.sendRawTransaction(pendingSend.build.hex);
      setLastSend({
        txid: txidResult,
        amount: pendingSend.amount,
        fee: pendingSend.build.fee,
        vsize: pendingSend.build.vsize,
        feeRateLinersPerKb: pendingSend.feeRateLinersPerKb,
        feeTarget: pendingSend.feeTarget,
        feeMode: pendingSend.feeMode,
        feePriorityLabel: pendingSend.feePriorityLabel,
        feeMultiplier: pendingSend.feeMultiplier,
        baseFeeRateLinersPerKb: pendingSend.baseFeeRateLinersPerKb,
        customFeeRatePerVb: pendingSend.customFeeRatePerVb,
      });
      setPendingMempool({ txid: txidResult, confirmations: 0 });
      setShowPendingBanner(true);
      scrollMainToTop();
      setStatus("Sent");
      setPendingSend(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const detail = err instanceof Error && "code" in err ? `(${(err as any).code})` : "";
      setError(message);
      setErrorDetail(detail || null);
    } finally {
      setSending(false);
    }
  };

  const onCancelSend = () => {
    setPendingSend(null);
    setStatus("Send cancelled");
  };

  useEffect(() => {
    if (!pendingMempool) return;
    let stop = false;
    const interval = setInterval(async () => {
      if (stop) return;
      try {
        const tx = await client.getRawTransaction(pendingMempool.txid, true);
        const conf = typeof tx.confirmations === "number" ? tx.confirmations : 0;
        if (conf > 0) {
          setPendingMempool({ txid: pendingMempool.txid, confirmations: conf });
          // Don't auto-close, let user dismiss
        } else {
          setPendingMempool({ txid: pendingMempool.txid, confirmations: conf });
        }
      } catch {
        // Ignore errors (e.g. tx not indexed yet), keep trying
        // Don't auto-close
      }
    }, 10_000);
    return () => {
      stop = true;
      clearInterval(interval);
    };
  }, [client, lastSend, pendingMempool]);

  return (
    <div className="grid lg:grid-cols-2 gap-6 h-full content-start">


      <Card className="lg:col-span-2">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">Send Funds</h3>

        <form onSubmit={onSubmit} className="grid md:grid-cols-2 gap-6">
          <div className="col-span-2 md:col-span-2 flex flex-col gap-6">
            <Input
              label="Destination Address"
              placeholder="Baseline Cash Address"
              value={dest}
              onChange={(e) => { setDest(e.target.value); resetPending(); }}
              required
            />
            <Input
              label="Amount (BLINE)"
              placeholder="0.00000000"
              inputMode="decimal"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); resetPending(); }}
              required
            />
          </div>

          <div>
            <Select
              label="Spend From"
              value={fromAddress}
              onChange={(val) => { setFromAddress(val); resetPending(); }}
              options={[
                { label: "Any available address", value: "" },
                ...keys.map((k) => ({
                  label: `${k.address.slice(0, 20)}...`,
                  value: k.address,
                  disabled: (addressStats[k.address]?.maturedLiners ?? 0) <= 0,
                  detail: addressStats[k.address] ? `${fromLiners(addressStats[k.address].maturedLiners ?? 0).toFixed(4)} BLINE` : undefined
                }))
              ]}
            />
            {addressStatsLoading && <div className="text-xs text-muted mt-2 animate-pulse">Loading balances...</div>}
          </div>

          <div>
            <Select
              label="Change Address"
              value={changeAddress}
              onChange={(val) => { setChangeAddress(val); resetPending(); }}
              options={keys.map((k) => ({
                label: `${k.address.slice(0, 24)}...`,
                value: k.address
              }))}
            />
          </div>

          <div className="col-span-2 border-t border-white/5 pt-6">
            <div className="flex justify-between items-end mb-4">
              <label className="text-xs font-bold uppercase tracking-wider text-muted block">Transaction Fee Prioirty</label>
              <div className="text-xs text-accent font-mono">{baseRateText}</div>
            </div>

            <div className="bg-panel-strong/30 rounded-xl p-1 mb-4">
              <div className="grid grid-cols-2 gap-1 mb-2">
                <button
                  type="button"
                  className={cn("py-1.5 rounded-lg text-xs font-bold transition-all", feeMode === "auto" ? "bg-accent/20 text-accent" : "text-muted hover:text-text hover:bg-white/5")}
                  onClick={() => { setFeeMode("auto"); resetPending(); }}
                >Auto Priority</button>
                <button
                  type="button"
                  className={cn("py-1.5 rounded-lg text-xs font-bold transition-all", feeMode === "custom" ? "bg-accent/20 text-accent" : "text-muted hover:text-text hover:bg-white/5")}
                  onClick={() => { setFeeMode("custom"); resetPending(); }}
                >Custom Rate</button>
              </div>

              {feeMode === "auto" ? (
                <div className="grid grid-cols-3 gap-2">
                  {FEE_PRESETS.map((p) => {
                    const base = baseEstimatedFeeRate ?? fallbackFeeRate;
                    const val = Math.max(MIN_RELAY_FEE_RATE_LINERS_PER_KB, Math.round(base * p.multiplier));
                    const ratePerVb = val / 1000;

                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => { setFeePresetKey(p.key); resetPending(); }}
                        className={cn(
                          "flex flex-col items-center justify-center p-2 rounded-lg border transition-all h-20",
                          feePresetKey === p.key ? "bg-accent/10 border-accent/40 text-accent shadow-sm" : "bg-panel border-transparent hover:bg-white/5 text-muted"
                        )}
                      >
                        <span className="font-bold text-sm">{p.label}</span>
                        <div className="flex flex-col items-center mt-1">
                          <span className="text-xs font-mono font-bold">{ratePerVb.toFixed(2)} L/vB</span>
                          <span className="text-[9px] opacity-60 uppercase tracking-wider font-semibold">{p.hint}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <Input
                  placeholder="e.g. 25 (liners/vB)"
                  value={customFeeRate}
                  onChange={(e) => { setCustomFeeRate(e.target.value); resetPending(); }}
                />
              )}
            </div>
            {feeNote && <p className="text-xs text-warning">{feeNote}</p>}
          </div>

          <div className="col-span-2 flex flex-col gap-4">
            {error && (
              <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl text-danger text-sm flex items-center gap-2 font-medium">
                <Warning weight="fill" />
                {error} <span className="text-xs opacity-70">{errorDetail}</span>
              </div>
            )}

            <Button type="submit" size="lg" disabled={building} loading={building}>
              {pendingSend ? "Update Review" : "Review Transaction"}
            </Button>
          </div>
        </form>
      </Card>

      {createPortal(
        <AnimatePresence>
          {pendingSend && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm font-sans"
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="w-full max-w-lg"
              >
                <Card glass className="shadow-2xl ring-1 ring-white/10">
                  <div className="mb-6 flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-lg">Confirm Transaction</h3>
                      <p className="text-muted text-sm">Sign and broadcast to the network</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-accent">{pendingSend.amount.toFixed(8)} BLINE</div>
                      <div className="text-xs text-muted font-mono">Sending Amount</div>
                    </div>
                  </div>

                  <div className="space-y-4 p-4 rounded-xl bg-black/40 border border-white/5 font-mono text-sm mb-6">
                    <div className="flex justify-between">
                      <span className="text-muted">Destination</span>
                      <span className="text-right ml-4 break-all text-white/90">{pendingSend.toAddress}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Network Fee</span>
                      <span className="text-right text-white/90">{fromLiners(pendingSend.build.fee).toFixed(8)} BLINE</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Fee Rate (Abs)</span>
                      <span className="text-right text-white/90">{(pendingSend.feeRateLinersPerKb / 1000).toFixed(2)} L/vB</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Button variant="ghost" onClick={onCancelSend} disabled={sending}>
                      <X size={18} className="mr-2" /> Cancel
                    </Button>
                    <Button onClick={onConfirmSend} disabled={sending} loading={sending}>
                      Confirm & Send <ArrowRight size={18} className="ml-2" />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {createPortal(
        <AnimatePresence>
          {pendingMempool && showPendingBanner && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm font-sans"
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="w-full max-w-md"
              >
                <Card glass className="shadow-2xl ring-1 ring-accent/20 flex flex-col items-center text-center p-8 relative overflow-hidden">
                  <div className="absolute inset-0 bg-accent/5 pointer-events-none" />
                  <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-transparent via-accent to-transparent opacity-50 pointer-events-none" />

                  <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center mb-6 ring-1 ring-accent/30 shadow-[0_0_40px_-10px_rgba(71,194,255,0.3)]">
                    <RocketLaunch weight="fill" className="text-accent text-4xl" />
                  </div>

                  <h3 className="text-2xl font-bold text-white mb-2">Transaction Sent!</h3>
                  <p className="text-muted text-sm mb-8 max-w-[80%] mx-auto">
                    Your funds have been broadcasted to the network and are awaiting confirmation.
                  </p>

                  {lastSend && (
                    <div className="w-full bg-black/40 rounded-xl p-4 border border-white/5 mb-8 text-left">
                      <div className="text-[10px] uppercase tracking-wider font-bold text-muted mb-1">Transaction ID</div>
                      <code className="text-xs text-accent/90 break-all font-mono select-all">
                        {lastSend.txid}
                      </code>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 w-full">
                    <Button
                      variant="ghost"
                      className="w-full"
                      onClick={(e) => {
                        if (lastSend?.txid) {
                          navigator.clipboard.writeText(lastSend.txid);
                          const span = e.currentTarget.querySelector('span');
                          if (span) {
                            const original = span.innerText;
                            span.innerText = "Copied!";
                            setTimeout(() => span.innerText = "Copy TX ID", 2000);
                          }
                        }
                      }}
                    >
                      <span>Copy TX ID</span>
                    </Button>
                    <Button className="w-full" onClick={() => setShowPendingBanner(false)}>
                      Done
                    </Button>
                  </div>
                </Card>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
