import { FormEvent, useEffect, useMemo, useState } from "react";

import { useSettings } from "../state/settings";
import { useWallet } from "../state/wallet";
import { buildAndSignTx, type SpendableUtxo } from "../lib/tx";
import { fromLiners, toLiners } from "../lib/wallet";

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
};

type LastSend = {
  txid: string;
  amount: number;
  fee: number;
  vsize: number;
  feeRateLinersPerKb: number;
  feeTarget: number;
};

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
  const [pendingSend, setPendingSend] = useState<PendingSend | null>(null);
  const [sending, setSending] = useState(false);
  const [lastSend, setLastSend] = useState<LastSend | null>(null);

  const addresses = useMemo(() => keys.map((k) => k.address), [keys]);

  const resetPending = () => {
    setPendingSend(null);
  };

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

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setError(null);
    setErrorDetail(null);
    setLastSend(null);
    setPendingSend(null);
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

      const queryAddresses = fromAddress ? [fromAddress] : addresses;
      const utxos = await client.getAddressUtxos(queryAddresses);
      const spendable: SpendableUtxo[] = utxos
        .filter((u) => keyRing[u.address])
        .map((u) => ({
          txid: u.txid,
          vout: u.outputIndex,
          value: u.liners,
          scriptPubKey: u.script,
          address: u.address,
        }));
      if (!spendable.length) {
        setError("No spendable UTXOs for your addresses");
        return;
      }
      const rate = typeof liveRate === "number" && Number.isFinite(liveRate) ? liveRate : 5_000;
      const build = buildAndSignTx(
        {
          utxos: spendable,
          toAddress: dest.trim(),
          amount: toLiners(amountNum),
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
      });
      setStatus("Review the details below");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const detail = err instanceof Error && "code" in err ? `(${(err as any).code})` : "";
      setError(message);
      setErrorDetail(detail || null);
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
      });
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

  return (
    <div className="card">
      <h3>Send</h3>
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
              <option key={k.address} value={k.address}>
                {k.address}
              </option>
            ))}
          </select>
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
        <div>
          <label>Fee rate (auto)</label>
          <div className="chip fee-chip">
            {feeLoading
              ? "Estimating..."
              : feeRate
                ? `${(feeRate / 100_000_000).toFixed(6)} BLINE/kB · target ~${feeTarget} blocks`
                : "Using fallback rate"}
          </div>
          {feeNote && <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>{feeNote}</div>}
        </div>
        <div className="span-2 send-actions">
          <button className="btn btn-primary" type="submit">
            {pendingSend ? "Update send" : "Send"}
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
                <div className="send-review-note">target ~{pendingSend.feeTarget} blocks</div>
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
        {lastSend && !pendingSend && (
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
                <div className="send-summary-note">target ~{lastSend.feeTarget} blocks</div>
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
