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
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-hero">
          <span className="pill">Bring your wallet</span>
          <h2>Import existing keys</h2>
          <p>
            Supports mnemonic, WIF, or Baseline wallet.json. Everything stays on this device and is encrypted with the
            passphrase you choose below.
          </p>
          <ul className="auth-list">
            <li>Never paste secrets into untrusted devices.</li>
            <li>Passphrase here encrypts the wallet on this device only.</li>
            <li>Seeds/keys are not sent to the node.</li>
          </ul>
        </div>
        <div className="auth-panel">
          <div className="auth-tabs">
            <button className={`auth-tab ${mode === "mnemonic" ? "active" : ""}`} type="button" onClick={() => setMode("mnemonic")}>
              Mnemonic
            </button>
            <button className={`auth-tab ${mode === "wif" ? "active" : ""}`} type="button" onClick={() => setMode("wif")}>
              WIF key
            </button>
            <button className={`auth-tab ${mode === "walletjson" ? "active" : ""}`} type="button" onClick={() => setMode("walletjson")}>
              wallet.json
            </button>
            <Link to="/create" className="auth-tab" style={{ textDecoration: "none", textAlign: "center" }}>
              New wallet
            </Link>
          </div>
          <form onSubmit={onSubmit} className="auth-form">
            <div className="full">
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
            <div className="full">
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
            <div className="full">
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
            {error && (
              <div className="full" style={{ color: "var(--danger)", fontWeight: 600 }}>
                {error}
              </div>
            )}
            <div className="auth-actions full">
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
