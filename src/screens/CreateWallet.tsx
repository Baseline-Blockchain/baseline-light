import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useWallet } from "../state/wallet";
import { AuthLayout } from "../components/AuthLayout";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Key, Warning } from "phosphor-react";

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

  const Hero = (
    <>
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent font-bold text-xs uppercase tracking-wider w-fit">
        <Key size={16} weight="fill" />
        New Wallet
      </div>
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-text">
        Create and secure your keys
      </h2>
      <p className="text-base text-muted leading-relaxed">
        Keys are generated locally and encrypted with your passphrase. There is no recovery service.
      </p>
      <ul className="space-y-2 text-muted/80 text-sm">
        <li className="flex gap-3 items-start">
          <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2" />
          <span>Passphrase encrypts your wallet file on this device.</span>
        </li>
        <li className="flex gap-3 items-start">
          <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2" />
          <span>Seed words can restore on any Baseline Cash-compatible wallet.</span>
        </li>
        {status !== "empty" && hasWallet && (
          <li className="flex gap-3 items-start text-warning font-medium">
            <Warning size={16} weight="fill" className="mt-1" />
            <span>Creating a new wallet replaces the current session keys after unlock.</span>
          </li>
        )}
      </ul>
    </>
  );

  return (
    <AuthLayout hero={Hero}>
      {!mnemonic ? (
        <form onSubmit={onSubmit} className="flex flex-col gap-6">
          <Input
            label="Passphrase"
            type="password"
            required
            placeholder="Strong passphrase"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
          />
          <Input
            label="Confirm Passphrase"
            type="password"
            required
            placeholder="Repeat passphrase"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={error || undefined}
          />

          <div className="flex flex-col gap-4 mt-2">
            <Button type="submit" loading={busy} size="lg" className="w-full">
              Create Wallet
            </Button>
            <Link to="/import">
              <Button variant="outline" size="lg" className="w-full">Import Existing</Button>
            </Link>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="text-center">
            <h3 className="text-xl font-bold text-accent mb-2">Wallet Created Successfully</h3>
            <p className="text-sm text-muted">Save these 12 words immediately. They are the only way to recover your funds.</p>
          </div>

          <div className="p-6 rounded-xl bg-black/40 border border-accent/20 font-mono text-lg leading-relaxed text-center select-all">
            {mnemonic}
          </div>

          <Button
            size="lg"
            className="w-full"
            onClick={() => navigate("/", { replace: true })}
          >
            I have saved my seed
          </Button>
        </div>
      )}
    </AuthLayout>
  );
}
