import { FormEvent, useState } from "react";
import { useSettings } from "../state/settings";
import { useWallet } from "../state/wallet";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Check, DownloadSimple, HardDrives, Plus, Trash, Warning } from "phosphor-react";

export function SettingsScreen() {
  const { rpcConfig, feeTarget, update } = useSettings();
  const { addAddress, keys, clear, exportBackup } = useWallet();

  const [rpcUrl, setRpcUrl] = useState(rpcConfig.url);
  const [target, setTarget] = useState(feeTarget.toString());
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [backupInfo, setBackupInfo] = useState<string | null>(null);
  const [confirmForget, setConfirmForget] = useState(false);

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
    setTimeout(() => setStatus(null), 3000);
  };

  const onAddAddress = async () => {
    setError(null);
    try {
      const added = await addAddress();
      setStatus(`Added ${added.address.slice(0, 10)}...`);
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
        if (typeof window !== "undefined" && "showSaveFilePicker" in window) {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: "wallet-backup.json",
            types: [{ description: "Baseline Cash wallet backup", accept: { "application/json": [".json"] } }],
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
    clear();
    setConfirmForget(false);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
      {/* Network Settings */}
      <Card>
        <div className="mb-6">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <GlobeIcon />
            Network
          </h3>
          <p className="text-sm text-muted mt-1">Configure connection to the Baseline network.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          <Input
            label="RPC URL"
            value={rpcUrl}
            onChange={(e) => setRpcUrl(e.target.value)}
            required
            placeholder="http://109.104.154.151:8832"
          />
          <Input
            label="Fee Target (Blocks)"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            inputMode="numeric"
            placeholder="6"
          />

          <div className="flex items-center gap-4">
            <Button type="submit">Save Changes</Button>
            {status === "Saved" && (
              <span className="text-accent text-sm font-bold flex items-center gap-1 animate-in fade-in">
                <Check weight="bold" /> Saved
              </span>
            )}
          </div>
        </form>
      </Card>

      {/* Wallet Management */}
      <Card>
        <div className="mb-6">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <HardDrives weight="duotone" className="text-accent" />
            Wallet Management
          </h3>
          <p className="text-sm text-muted mt-1">Local keys and backup.</p>
        </div>

        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex justify-between items-center">
            <div>
              <div className="font-bold text-sm">Derived Addresses</div>
              <div className="text-xs text-muted">{keys.length} active addresses</div>
            </div>
            <Button size="sm" variant="secondary" onClick={onAddAddress}>
              <Plus weight="bold" className="mr-1" /> New
            </Button>
          </div>

          <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex justify-between items-center">
            <div>
              <div className="font-bold text-sm">Backup Wallet</div>
              <div className="text-xs text-muted">Save your keys safely</div>
            </div>
            <Button size="sm" variant="secondary" onClick={onBackup}>
              <DownloadSimple weight="bold" className="mr-1" /> Export
            </Button>
          </div>

          {!confirmForget ? (
            <Button variant="danger" className="w-full mt-4" onClick={() => setConfirmForget(true)}>
              <Trash weight="bold" className="mr-2" /> Forget Wallet
            </Button>
          ) : (
            <div className="mt-4 p-4 rounded-xl border border-danger/30 bg-danger/5 animate-in slide-in-from-top-2">
              <h4 className="font-bold text-danger text-sm flex items-center gap-2">
                <Warning weight="fill" /> Confirm Deletion?
              </h4>
              <p className="text-xs text-muted mt-1 mb-3">This will remove your keys from this device. Make sure you have a backup!</p>
              <div className="flex gap-2">
                <Button size="sm" variant="danger" onClick={onClear}>Yes, Delete</Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmForget(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {status && status !== "Saved" && <div className="text-sm text-accent">{status}</div>}
          {backupInfo && <div className="text-sm text-accent">{backupInfo}</div>}
          {error && <div className="text-sm text-danger">{error}</div>}
        </div>
      </Card>
    </div>
  );
}

function GlobeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 256 256" className="text-accent">
      <path fill="currentColor" d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm0-160a72,72,0,1,0,72,72A72.08,72.08,0,0,0,128,56Zm0,128a56,56,0,1,1,56-56A56.06,56.06,0,0,1,128,184Z"></path>
    </svg>
  )
}
