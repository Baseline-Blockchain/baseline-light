import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../state/wallet";
import { AuthLayout } from "../components/AuthLayout";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { ShieldCheck, Warning } from "phosphor-react";

export function LockScreen() {
  const { unlock, hasWallet, clear, status } = useWallet();
  const navigate = useNavigate();
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmForget, setConfirmForget] = useState(false);

  // If no wallet is stored, send to create/import instead of showing unlock UI.
  useEffect(() => {
    if (status === "empty" && !hasWallet) {
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

  const Hero = (
    <>
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent font-bold text-xs uppercase tracking-wider w-fit">
        <ShieldCheck size={16} weight="fill" />
        Baseline Cash Light
      </div>
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-text">
        Welcome back
      </h2>
      <p className="text-base text-muted leading-relaxed">
        Unlock with your passphrase. Your keys never leave this device.
      </p>
      <ul className="space-y-2 text-muted/80 text-sm">
        <li className="flex gap-3 items-start">
          <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2" />
          <span>Keep your passphrase private; it decrypts the wallet locally.</span>
        </li>
        <li className="flex gap-3 items-start">
          <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2" />
          <span>Use "Forget wallet" only if you have the seed backed up.</span>
        </li>
      </ul>
    </>
  );

  return (
    <AuthLayout hero={Hero}>
      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <Input
          label="Passphrase"
          type="password"
          autoFocus
          required
          placeholder="Enter the passphrase you encrypted with"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          error={error || undefined}
        />

        <div className="flex flex-col gap-4 mt-2">
          <Button type="submit" loading={busy} size="lg" className="w-full">
            Unlock Wallet
          </Button>

          {hasWallet && !confirmForget && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="border-danger/30 text-danger hover:bg-danger/10 hover:text-danger hover:border-danger/60 w-full"
              onClick={() => setConfirmForget(true)}
            >
              Forget wallet
            </Button>
          )}
        </div>
      </form>

      {confirmForget && (
        <div className="mt-6 p-4 rounded-xl border border-danger/30 bg-danger/5">
          <div className="flex items-start gap-3">
            <Warning className="text-danger shrink-0 mt-0.5" size={20} weight="fill" />
            <div className="flex flex-col gap-4 w-full">
              <div>
                <h4 className="font-bold text-danger">Forget wallet?</h4>
                <p className="text-sm text-muted mt-1">This removes keys locally. Ensure you have your seed backed up.</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="danger" onClick={onForget}>
                  Confirm Forget
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmForget(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AuthLayout>
  );
}
