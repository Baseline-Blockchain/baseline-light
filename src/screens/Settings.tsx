import { FormEvent, useState } from "react";

import { useSettings } from "../state/settings";
import { useWallet } from "../state/wallet";

export function SettingsScreen() {
  const { rpcConfig, feeTarget, update } = useSettings();
  const { addAddress, keys, clear, exportBackup } = useWallet();

  const [rpcUrl, setRpcUrl] = useState(rpcConfig.url);
  const [target, setTarget] = useState(feeTarget.toString());
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [backupInfo, setBackupInfo] = useState<string | null>(null);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setError(null);
    const parsedTarget = Number(target) || feeTarget;
    update({
      rpcConfig: {
        url: rpcUrl.trim(),
      },
      feeTarget: parsedTarget,
    });
    setStatus("Saved");
  };

  const onAddAddress = async () => {
    setError(null);
    try {
      const added = await addAddress();
      setStatus(`Added ${added.address}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  };

  const onBackup = () => {
    setError(null);
    setBackupInfo(null);
    try {
      const payload = exportBackup();
      const download = async () => {
        // Prefer a real file picker if the engine supports it.
        if (typeof window !== "undefined" && "showSaveFilePicker" in window) {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: "wallet-backup.json",
            types: [{ description: "Baseline wallet backup", accept: { "application/json": [".json"] } }],
          });
          const writable = await handle.createWritable();
          await writable.write(payload);
          await writable.close();
          return;
        }
        const blob = new Blob([payload], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        document.body.appendChild(anchor);
        anchor.href = url;
        anchor.download = "wallet-backup.json";
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
      };
      void download();
      setBackupInfo("Backup downloaded");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  };

  const onClear = () => {
    const confirmed = window.confirm("Forget wallet? This removes keys from this device. Make sure you saved your seed/backup.");
    if (confirmed) {
      clear();
    }
  };

  return (
    <div className="settings-grid">
      <div className="card settings-card">
        <div>
          <h3>RPC endpoint</h3>
          <p className="settings-note">Public Baseline node used for reads and broadcasting.</p>
        </div>
        <form onSubmit={onSubmit} className="settings-card">
          <div className="settings-field">
            <label htmlFor="rpc">RPC URL</label>
            <input id="rpc" value={rpcUrl} onChange={(e) => setRpcUrl(e.target.value)} required />
            <span className="settings-note">Default: http://109.104.154.151:8832</span>
          </div>
          <div className="settings-field">
            <label htmlFor="target">Fee target (blocks)</label>
            <input id="target" inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="6" />
            <span className="settings-note">Used for estimatesmartfee before sending.</span>
          </div>
          <div className="settings-actions">
            <button className="btn btn-primary" type="submit">
              Save changes
            </button>
            {status && <span className="chip">{status}</span>}
            {error && <span style={{ color: "var(--danger)" }}>{error}</span>}
          </div>
        </form>
      </div>
      <div className="card settings-card">
        <div>
          <h3>Wallet controls</h3>
          <p className="settings-note">Keys stay local. Add receive addresses, back up, or forget this wallet.</p>
        </div>
        <div className="settings-actions">
          <button className="btn btn-ghost" type="button" onClick={onAddAddress}>
            Add address
          </button>
          <div className="chip">{keys.length} addresses</div>
        </div>
        <div className="settings-actions">
          <button className="btn btn-ghost" type="button" onClick={onBackup}>
            Download backup
          </button>
          {backupInfo && <span className="chip">{backupInfo}</span>}
        </div>
        <div className="settings-actions">
          <button className="btn btn-danger" type="button" onClick={onClear}>
            Forget wallet
          </button>
        </div>
      </div>
    </div>
  );
}
