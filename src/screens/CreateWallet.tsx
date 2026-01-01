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
    <div className="shell-main" style={{ maxWidth: 920, margin: "60px auto" }}>
      <div className="card" style={{ padding: 32, display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 24 }}>
        <div>
          <div className="chip">New wallet</div>
          <h2 style={{ margin: "10px 0 6px" }}>Create and secure your keys</h2>
          <p style={{ color: "var(--muted)" }}>
            Keys are generated locally and encrypted with your passphrase. There is no recovery service—save the 12-word
            seed before continuing.
          </p>
          <ul style={{ marginTop: 12, color: "var(--muted)" }}>
            <li>Passphrase encrypts your wallet file on this device.</li>
            <li>Seed words can restore on any Baseline-compatible wallet.</li>
            <li>No wallet RPC used; only public node calls for balances/broadcast.</li>
          </ul>
          {status !== "empty" && hasWallet && (
            <div style={{ marginTop: 12, color: "var(--muted)" }}>
              Creating a new wallet replaces the current session keys after unlock.
            </div>
          )}
        </div>
        <div>
          <form onSubmit={onSubmit} className="grid-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div style={{ gridColumn: "1 / -1" }}>
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
            <div style={{ gridColumn: "1 / -1" }}>
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
            {error && <div style={{ gridColumn: "1 / -1", color: "var(--danger)" }}>{error}</div>}
            <div style={{ display: "flex", gap: "12px", alignItems: "center", gridColumn: "1 / -1", flexWrap: "wrap" }}>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? "Creating..." : "Create wallet"}
              </button>
              <Link to="/import" className="btn btn-ghost">
                Import existing
              </Link>
            </div>
          </form>
          {mnemonic && (
            <div style={{ marginTop: 16 }}>
              <div className="chip">Save these 12 words before proceeding</div>
              <div
                style={{
                  marginTop: 12,
                  padding: 16,
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px dashed var(--border)",
                  lineHeight: 1.6,
                  fontWeight: 600,
                }}
              >
                {mnemonic}
              </div>
              <div style={{ marginTop: 12, display: "flex", gap: 12 }}>
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
