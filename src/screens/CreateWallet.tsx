import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useWallet } from "../state/wallet";

export function CreateWalletScreen() {
  const { createWallet, status, hasWallet } = useWallet();
  const navigate = useNavigate();
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [mnemonic, setMnemonic] = useState<string | null>(null);
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
      const wallet = await createWallet(passphrase);
      if (wallet.kind === "mnemonic") {
        setMnemonic(wallet.mnemonic);
      }
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
          <span className="pill">New wallet</span>
          <h2>Create and secure your keys</h2>
          <p>
            Keys are generated locally and encrypted with your passphrase. There is no recovery service; save the
            12-word seed before continuing.
          </p>
          <ul className="auth-list">
            <li>Passphrase encrypts your wallet file on this device.</li>
            <li>Seed words can restore on any Baseline-compatible wallet.</li>
            <li>No wallet RPC used; only public node calls for balances/broadcast.</li>
          </ul>
          {status !== "empty" && hasWallet && (
            <div className="auth-note">Creating a new wallet replaces the current session keys after unlock.</div>
          )}
        </div>
        <div className="auth-panel">
          <form onSubmit={onSubmit} className="auth-form">
            <div className="full">
              <label htmlFor="passphrase">Passphrase</label>
              <input
                id="passphrase"
                type="password"
                required
                placeholder="Strong passphrase"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
              />
            </div>
            <div className="full">
              <label htmlFor="confirm">Confirm passphrase</label>
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
                {busy ? "Creating..." : "Create wallet"}
              </button>
              <Link to="/import" className="btn btn-ghost">
                Import existing
              </Link>
            </div>
          </form>
          {mnemonic && (
            <div className="auth-callout">
              <div className="title">Save these 12 words before proceeding</div>
              <div className="auth-seed">{mnemonic}</div>
              <div className="auth-actions">
                <button className="btn btn-primary" type="button" onClick={() => navigate("/", { replace: true })}>
                  Continue to wallet
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
