import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useWallet } from "../state/wallet";

export function LockScreen() {
  const { unlock, hasWallet, clear, status } = useWallet();
  const navigate = useNavigate();
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // If no wallet is stored, send to create/import instead of showing unlock UI.
  useEffect(() => {
    if (status === "empty" || !hasWallet) {
      navigate("/create", { replace: true });
    }
  }, [status, hasWallet, navigate]);

  const onForget = () => {
    const confirmed = window.confirm("Forget wallet from this device? Make sure you have your seed/backup first.");
    if (confirmed) {
      clear();
    }
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
    <div className="shell-main" style={{ maxWidth: 720, margin: "60px auto" }}>
      <div className="card" style={{ padding: 32 }}>
        <div style={{ marginBottom: 16 }}>
          <div className="chip">Baseline Light</div>
          <h2 style={{ margin: "8px 0 4px" }}>Welcome back</h2>
          <p style={{ color: "var(--muted)" }}>Unlock with your passphrase. Keys never leave this device.</p>
        </div>
        <form onSubmit={onSubmit} className="grid-2" style={{ gridTemplateColumns: "1fr" }}>
          <div>
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
          {error && <div style={{ color: "var(--danger)" }}>{error}</div>}
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? "Unlocking..." : "Unlock"}
            </button>
            {hasWallet && (
              <button type="button" className="btn btn-danger" onClick={onForget}>
                Forget wallet
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
