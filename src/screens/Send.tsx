import { FormEvent, useEffect, useMemo, useState } from "react";

import { useSettings } from "../state/settings";
import { useWallet } from "../state/wallet";
import { buildAndSignTx, type SpendableUtxo } from "../lib/tx";
import { fromLiners, toLiners } from "../lib/wallet";

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
  const [txid, setTxid] = useState<string | null>(null);
  const [feeRate, setFeeRate] = useState<number | null>(null);
  const [feeLoading, setFeeLoading] = useState(false);
  const [feeNote, setFeeNote] = useState<string | null>(null);

  const addresses = useMemo(() => keys.map((k) => k.address), [keys]);

  useEffect(() => {
    async function fetchFee() {
      setFeeLoading(true);
      try {
        const est = await client.estimateSmartFee(feeTarget);
        if (est && typeof est.feerate === "number") {
          setFeeRate(est.feerate * 100_000_000); // convert to liners/kB
          setFeeNote(null);
        } else {
          setFeeNote("Fee estimate unavailable; using fallback");
        }
      } catch (err) {
        setFeeNote("Fee estimate failed; using fallback");
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
    setTxid(null);
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
      const feeBline = fromLiners(build.fee);
      const shouldSend = window.confirm(
        `Send ${amountNum.toFixed(8)} BLINE?\nEstimated fee: ${feeBline.toFixed(8)} BLINE (vsize ${build.vsize}).`,
      );
      if (!shouldSend) {
        setStatus("Send cancelled");
        return;
      }
      const txidResult = await client.sendRawTransaction(build.hex);
      setTxid(txidResult);
      setStatus(
        `Sent ${amountNum.toFixed(8)} BLINE with fee ${fromLiners(build.fee).toFixed(8)} BLINE (vsize ${build.vsize})`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const detail = err instanceof Error && "code" in err ? `(${(err as any).code})` : "";
      setError(message);
      setErrorDetail(detail || null);
    }
  };

  return (
    <div className="card">
      <h3>Send</h3>
      <form onSubmit={onSubmit} className="grid-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="dest">Destination address</label>
          <input
            id="dest"
            required
            placeholder="Baseline address"
            value={dest}
            onChange={(e) => setDest(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="from">Spend from (optional)</label>
          <select id="from" className="select-control" value={fromAddress} onChange={(e) => setFromAddress(e.target.value)}>
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
            onChange={(e) => setChangeAddress(e.target.value)}
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
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div>
          <label>Fee (auto)</label>
          <div className="chip" style={{ width: "fit-content", fontWeight: 600 }}>
            {feeLoading
              ? "Estimating..."
              : feeRate
                ? `${(feeRate / 100_000_000).toFixed(6)} BLINE/kB · target ~${feeTarget} blocks`
                : "Using fallback rate"}
          </div>
          {feeNote && <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>{feeNote}</div>}
        </div>
        <div style={{ gridColumn: "1 / -1", display: "flex", gap: 12, alignItems: "center" }}>
          <button className="btn btn-primary" type="submit">
            Send
          </button>
          {status && <span className="chip">{status}</span>}
          {txid && (
            <span className="chip" style={{ background: "rgba(255,255,255,0.05)" }}>
              txid: {txid}
            </span>
          )}
        </div>
        {error && (
          <div style={{ gridColumn: "1 / -1", color: "var(--danger)" }}>
            <strong>Error:</strong> {error} {errorDetail ?? ""}
          </div>
        )}
      </form>
    </div>
  );
}
