import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useWallet } from "../state/wallet";

export function LockScreen() {
  const { unlock, hasWallet, clear, status } = useWallet();
  const navigate = useNavigate();
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmForget, setConfirmForget] = useState(false);

  // If no wallet is stored, send to create/import instead of showing unlock UI.
  useEffect(() => {
    if (status === "empty" || !hasWallet) {
      navigate("/create", { replace: true });
    }
  }, [status, hasWallet, navigate]);

  const onForget = () => {
    clear();
    setConfirmForget(false);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await unlock(passphrase);
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
          <span className="pill">Baseline Light</span>
          <h2>Welcome back</h2>
          <p>Unlock with your passphrase. Keys never leave this device.</p>
          <ul className="auth-list">
            <li>Keep your passphrase private; it decrypts the wallet locally.</li>
            <li>Use “Forget wallet” only if you have the seed backed up.</li>
            <li>Need to start over? Create or import from Settings later.</li>
          </ul>
        </div>
        <div className="auth-panel">
          <form onSubmit={onSubmit} className="auth-form">
            <div className="full">
              <label htmlFor="passphrase">Passphrase</label>
              <input
                id="passphrase"
                type="password"
                autoFocus
                required
                placeholder="Enter the passphrase you encrypted with"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
              />
            </div>
            {error && (
              <div className="full" style={{ color: "var(--danger)", fontWeight: 600 }}>
                {error}
              </div>
            )}
            <div className="auth-actions full">
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? "Unlocking..." : "Unlock"}
              </button>
              {hasWallet && !confirmForget && (
                <button type="button" className="btn btn-danger" onClick={() => setConfirmForget(true)}>
                  Forget wallet
                </button>
              )}
            </div>
          </form>
          {confirmForget && (
            <div className="confirm-panel">
              <div>
                <div className="confirm-title">Forget wallet from this device?</div>
                <div className="confirm-note">This removes keys locally. Make sure you have your seed or backup first.</div>
              </div>
              <div className="confirm-actions">
                <button type="button" className="btn btn-danger" onClick={onForget}>
                  Confirm forget
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setConfirmForget(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
