import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useWallet } from "../state/wallet";

export function ImportWalletScreen() {
  const { importMnemonic, importWif, importWalletJson } = useWallet();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"mnemonic" | "wif" | "walletjson">("mnemonic");
  const [secret, setSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (passphrase !== confirm) {
      setError("Passphrases do not match");
      return;
    }
    setBusy(true);
    try {
      if (mode === "mnemonic") {
        await importMnemonic(secret, passphrase);
      } else if (mode === "wif") {
        await importWif(secret, passphrase);
      } else {
        await importWalletJson(secret, passphrase);
      }
      navigate("/", { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="shell-main" style={{ maxWidth: 920, margin: "60px auto" }}>
      <div className="card" style={{ padding: 32, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div>
          <div className="chip">Bring your wallet</div>
          <h2 style={{ margin: "10px 0 6px" }}>Import existing keys</h2>
          <p style={{ color: "var(--muted)" }}>
            Supports mnemonic, WIF, or Baseline <code>wallet.json</code>. Everything is encrypted locally with the
            passphrase you choose below.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button className={`btn ${mode === "mnemonic" ? "btn-primary" : "btn-ghost"}`} type="button" onClick={() => setMode("mnemonic")}>
              Mnemonic
            </button>
            <button className={`btn ${mode === "wif" ? "btn-primary" : "btn-ghost"}`} type="button" onClick={() => setMode("wif")}>
              WIF key
            </button>
            <button className={`btn ${mode === "walletjson" ? "btn-primary" : "btn-ghost"}`} type="button" onClick={() => setMode("walletjson")}>
              wallet.json
            </button>
            <Link to="/create" className="btn btn-ghost">
              New wallet
            </Link>
          </div>
          <ul style={{ marginTop: 12, color: "var(--muted)" }}>
            <li>Never paste secrets into untrusted devices.</li>
            <li>Passphrase here encrypts the wallet on this device only.</li>
            <li>Seeds/keys are not sent to the node.</li>
          </ul>
        </div>
        <div>
          <form onSubmit={onSubmit} className="grid-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="secret">
                {mode === "mnemonic" ? "12-word mnemonic" : mode === "wif" ? "WIF private key" : "wallet.json contents"}
              </label>
              <textarea
                id="secret"
                rows={mode === "mnemonic" ? 3 : mode === "wif" ? 2 : 6}
                required
                placeholder={
                  mode === "mnemonic"
                    ? "word1 word2 ..."
                    : mode === "wif"
                      ? "L1aW4aubDFB7yfras2S1mN3bqg9w7..."
                      : "{ \"seed\": \"...\", \"encrypted\": false, ... }"
                }
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="passphrase">Passphrase</label>
              <input
                id="passphrase"
                type="password"
                required
                placeholder="Encrypt wallet on this device"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="confirm">Confirm</label>
              <input
                id="confirm"
                type="password"
                required
                placeholder="Repeat passphrase"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            {error && <div style={{ gridColumn: "1 / -1", color: "var(--danger)" }}>{error}</div>}
            <div style={{ display: "flex", gap: 12, alignItems: "center", gridColumn: "1 / -1", flexWrap: "wrap" }}>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? "Importing..." : "Import"}
              </button>
              <Link to="/lock" className="btn btn-ghost">
                Back
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
