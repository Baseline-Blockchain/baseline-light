import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { useSettings } from "../state/settings";
import { useWallet } from "../state/wallet";
import { buildAndSignTx, selectUtxos, type SpendableUtxo } from "../lib/tx";
import { fromLiners, toLiners } from "../lib/wallet";

const MIN_RELAY_FEE_RATE_LINERS_PER_KB = 5_000;
type FeeMode = "auto" | "custom";

const FEE_PRESETS = [
  { key: "eco", label: "Eco", multiplier: 0.85, hint: "Cheaper · may wait longer" },
  { key: "standard", label: "Standard", multiplier: 1, hint: "Balanced" },
  { key: "fast", label: "Fast", multiplier: 1.3, hint: "Prioritizes confirmation" },
  { key: "turbo", label: "Turbo", multiplier: 1.6, hint: "Top of mempool" },
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
  const [feePresetKey, setFeePresetKey] = useState<(typeof FEE_PRESETS)[number]["key"]>("fast");
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

  const fallbackFeeRate = 5_000; // liners/kB fallback if estimatesmartfee is unavailable

  const selectedPreset = useMemo(
    () => FEE_PRESETS.find((p) => p.key === feePresetKey) ?? FEE_PRESETS[0],
    [feePresetKey],
  );

  const parsedCustomRateLinersPerKb = useMemo(() => {
    const numeric = Number(customFeeRate);
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    return Math.round(numeric * 1000); // input is liners/vB, convert to per-kB
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
      ? `${(baseEstimatedFeeRate / 1000).toFixed(2)} liners/vB · target ~${feeTarget} blocks`
      : `Using fallback ${(fallbackFeeRate / 1000).toFixed(2)} liners/vB (estimatesmartfee unavailable)`;

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
      // refresh fee just before send
      let liveRate = feeRate;
      try {
        const est = await client.estimateSmartFee(feeTarget);
        if (est && typeof est.feerate === "number") {
          liveRate = est.feerate * 100_000_000;
          setFeeRate(liveRate);
        }
        const errors = Array.isArray(est?.errors) ? est.errors.filter(Boolean) : [];
        if (errors.length > 0) {
          setFeeNote(`estimatesmartfee: ${errors.join(" ")}`);
        } else if (!est || typeof est.feerate !== "number") {
          setFeeNote("estimatesmartfee: no feerate returned; using fallback");
        } else {
          setFeeNote(null);
        }
      } catch {
        // keep previous or fallback
      }

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
      setStatus("Review the details below");
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
    // No-op when not pending; only poll after a send in this session.
  }, [lastSend, pendingMempool]);

  useEffect(() => {
    if (!pendingMempool) return;
    let stop = false;
    const interval = setInterval(async () => {
      if (stop) return;
      try {
        const tx = await client.getRawTransaction(pendingMempool.txid, true);
        const conf = typeof tx.confirmations === "number" ? tx.confirmations : 0;
        if (conf > 0) {
          setPendingMempool(null);
          setShowPendingBanner(false);
        } else {
          setPendingMempool({ txid: pendingMempool.txid, confirmations: conf });
        }
      } catch {
        // If the tx is missing (not in mempool or chain), drop the banner.
        setPendingMempool(null);
        setShowPendingBanner(false);
      }
    }, 10_000);
    return () => {
      stop = true;
      clearInterval(interval);
    };
  }, [client, lastSend, pendingMempool]);

  return (
    <div className="card">
      <h3 style={{ marginBottom: pendingMempool && showPendingBanner ? 8 : 16 }}>Send</h3>
      {pendingMempool && showPendingBanner && (
        <div
          style={{
            marginBottom: 14,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid var(--accent-muted, #2f7fff33)",
            background: "var(--surface-1)",
            boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ fontWeight: 600, color: "var(--text)" }}>Successfully sent transaction</div>
            <button
              type="button"
              onClick={() => setShowPendingBanner(false)}
              style={{
                border: "none",
                background: "transparent",
                color: "var(--muted)",
                cursor: "pointer",
                fontSize: 12,
                padding: "4px 6px",
              }}
              aria-label="Dismiss pending notice"
            >
              Dismiss
            </button>
          </div>
          <div style={{ color: "var(--muted)", marginTop: 4, fontSize: 13 }}>
            Transaction was broadcasted and will be included in a block soon.
          </div>
          {lastSend && (
            <div style={{ color: "var(--muted-strong)", marginTop: 6, fontSize: 12 }}>
              Transaction Hash: <code>{`${lastSend.txid}`}</code>
            </div>
          )}
        </div>
      )}
      <form onSubmit={onSubmit} className="grid-2 send-form">
        <div className="span-2">
          <label htmlFor="dest">Destination address</label>
          <input
            id="dest"
            required
            placeholder="Baseline address"
            value={dest}
            onChange={(e) => {
              setDest(e.target.value);
              resetPending();
            }}
          />
        </div>
        <div>
          <label htmlFor="from">Spend from (optional)</label>
          <select
            id="from"
            className="select-control"
            value={fromAddress}
            onChange={(e) => {
              setFromAddress(e.target.value);
              resetPending();
            }}
          >
            <option value="">Use any wallet address</option>
            {keys.map((k) => (
              <option
                key={k.address}
                value={k.address}
                disabled={(addressStats[k.address]?.maturedLiners ?? 0) <= 0}
              >
                {k.address}
                {addressStats[k.address] &&
                  ` · ${fromLiners(addressStats[k.address].maturedLiners ?? 0).toFixed(8)} BLINE`}
              </option>
            ))}
          </select>
          {addressStatsLoading && <div className="skeleton skeleton-line" style={{ width: "60%", marginTop: 6 }} />}
          {addressStatsError && (
            <div style={{ color: "var(--warning)", fontSize: 12, marginTop: 6 }}>Balance lookup failed: {addressStatsError}</div>
          )}
        </div>
        <div>
          <label htmlFor="change">Return/change address</label>
          <select
            id="change"
            className="select-control"
            value={changeAddress}
            onChange={(e) => {
              setChangeAddress(e.target.value);
              resetPending();
            }}
            required
          >
            <option value="">Select where leftover funds return</option>
            {keys.map((k) => (
              <option key={k.address} value={k.address}>
                {k.address}
              </option>
            ))}
          </select>
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
            If not sure, leave as your primary address.
          </div>
        </div>
        <div>
          <label htmlFor="amount">Amount (BLINE)</label>
          <input
            id="amount"
            required
            inputMode="decimal"
            placeholder="0.10000000"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              resetPending();
            }}
          />
        </div>
        <div className="span-2">
          <label>Fee & priority</label>
          <div className="fee-box">
            <div className="fee-row">
              <div className={`chip fee-chip${feeLoading ? " skeleton skeleton-chip" : ""}`}>
                {!feeLoading && baseRateText}
              </div>
              <div className="fee-mode-toggle">
                <button
                  type="button"
                  className={`fee-mode-btn${feeMode === "auto" ? " active" : ""}`}
                  onClick={() => {
                    setFeeMode("auto");
                    setStatus(null);
                    resetPending();
                  }}
                >
                  Boosted auto
                </button>
                <button
                  type="button"
                  className={`fee-mode-btn${feeMode === "custom" ? " active" : ""}`}
                  onClick={() => {
                    setFeeMode("custom");
                    setStatus(null);
                    resetPending();
                  }}
                >
                  Custom (liners/vB)
                </button>
              </div>
            </div>
            {feeMode === "auto" ? (
              <div className="fee-preset-grid">
                {FEE_PRESETS.map((preset) => (
                  <button
                    type="button"
                    key={preset.key}
                    className={`fee-preset${feePresetKey === preset.key ? " active" : ""}`}
                    onClick={() => {
                      setFeePresetKey(preset.key);
                      resetPending();
                    }}
                  >
                    <div className="fee-preset-title">
                      {preset.label}{" "}
                      <span className="fee-preset-multiplier">
                        ×{preset.multiplier.toFixed(2).replace(/\.?0+$/, "")}
                      </span>
                    </div>
                    <div className="fee-preset-hint">{preset.hint}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="fee-custom">
                <input
                  inputMode="decimal"
                  placeholder="e.g. 25 (liners/vB, like sats/vB)"
                  value={customFeeRate}
                  onChange={(e) => {
                    setCustomFeeRate(e.target.value);
                    resetPending();
                  }}
                />
                <div className="fee-note">
                  We interpret this as liners/vB. {previewFeeRate ? `≈ ${(previewFeeRate / 100_000_000).toFixed(6)} BLINE/kB` : "Enter a number to preview."}
                </div>
              </div>
            )}
            {previewFeeRatePerVb !== null && previewFeeRate !== null && (
              <div className="fee-note">
                Effective rate: {previewFeeRatePerVb.toFixed(2)} liners/vB · {(previewFeeRate / 100_000_000).toFixed(6)} BLINE/kB
              </div>
            )}
            {previewClamped && <div className="fee-note">Raised to minimum relay fee</div>}
            {feeNote && <div className="fee-note">{feeNote}</div>}
          </div>
        </div>
        <div className="span-2 send-actions">
          <button className="btn btn-primary" type="submit" disabled={building}>
            {building ? "Preparing..." : pendingSend ? "Update review" : "Review & send"}
          </button>
          {status && <span className="send-status">{status}</span>}
        </div>
        {pendingSend && (
          <div className="span-2 send-review">
            <div className="send-review-header">
              <div>
                <div className="send-review-title">Review send</div>
                <div className="send-review-subtitle">Confirm before broadcasting.</div>
              </div>
              <div className="send-review-amount">{pendingSend.amount.toFixed(8)} BLINE</div>
            </div>
            <div className="send-review-grid">
              <div>
                <div className="send-review-label">Destination</div>
                <div className="send-review-value">{pendingSend.toAddress}</div>
              </div>
              <div>
                <div className="send-review-label">Estimated fee (this tx)</div>
                <div className="send-review-value">{fromLiners(pendingSend.build.fee).toFixed(8)} BLINE</div>
                <div className="send-review-note">vsize {pendingSend.build.vsize}</div>
              </div>
              <div>
                <div className="send-review-label">Fee rate</div>
                <div className="send-review-value">
                  {(pendingSend.feeRateLinersPerKb / 100_000_000).toFixed(6)} BLINE/kB
                </div>
                <div className="send-review-note">
                  {pendingSend.feeMode === "custom" ? (
                    <>Manual {pendingSend.customFeeRatePerVb?.toFixed(2) ?? (pendingSend.feeRateLinersPerKb / 1000).toFixed(2)} liners/vB</>
                  ) : (
                    <>
                      {pendingSend.feePriorityLabel} · target ~{pendingSend.feeTarget} blocks · boost ×
                      {pendingSend.feeMultiplier.toFixed(2).replace(/\.?0+$/, "")}
                    </>
                  )}
                </div>
                {pendingSend.baseFeeRateLinersPerKb !== null && pendingSend.feeMode === "auto" && (
                  <div className="send-review-note">
                    Base est: {(pendingSend.baseFeeRateLinersPerKb / 1000).toFixed(2)} liners/vB
                  </div>
                )}
              </div>
            </div>
            <div className="send-review-actions">
              <button className="btn btn-primary" type="button" onClick={onConfirmSend} disabled={sending}>
                {sending ? "Sending..." : "Confirm send"}
              </button>
              <button className="btn btn-ghost" type="button" onClick={onCancelSend} disabled={sending}>
                Cancel
              </button>
            </div>
          </div>
        )}
        {lastSend && !pendingSend && !pendingMempool && (
          <div className="span-2 send-summary">
            <div className="send-summary-header">
              <div className="send-summary-title">Last sent transaction</div>
              <div className="send-summary-amount">{lastSend.amount.toFixed(8)} BLINE</div>
            </div>
            <div className="send-summary-grid">
              <div>
                <div className="send-summary-label">Fee paid</div>
                <div className="send-summary-value">{fromLiners(lastSend.fee).toFixed(8)} BLINE</div>
                <div className="send-summary-note">vsize {lastSend.vsize}</div>
              </div>
              <div>
                <div className="send-summary-label">Fee rate</div>
                <div className="send-summary-value">
                  {(lastSend.feeRateLinersPerKb / 100_000_000).toFixed(6)} BLINE/kB
                </div>
                <div className="send-summary-note">
                  {lastSend.feeMode === "custom"
                    ? `Manual ${lastSend.customFeeRatePerVb?.toFixed(2) ?? (lastSend.feeRateLinersPerKb / 1000).toFixed(2)} liners/vB`
                    : `${lastSend.feePriorityLabel} · target ~${lastSend.feeTarget} blocks · boost ×${lastSend.feeMultiplier
                        .toFixed(2)
                        .replace(/\.?0+$/, "")}`}
                </div>
              </div>
              <div className="send-summary-txid">
                <div className="send-summary-label">Transaction id</div>
                <code className="send-summary-code">{lastSend.txid}</code>
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="span-2" style={{ color: "var(--danger)" }}>
            <strong>Error:</strong> {error} {errorDetail ?? ""}
          </div>
        )}
      </form>
    </div>
  );
}
