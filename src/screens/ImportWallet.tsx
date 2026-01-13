import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useWallet } from "../state/wallet";
import { AuthLayout } from "../components/AuthLayout";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { cn } from "../lib/utils";
import { DownloadSimple, FileCode, Key, TextT } from "phosphor-react";

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

  const Hero = (
    <>
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent font-bold text-xs uppercase tracking-wider w-fit">
        <DownloadSimple size={16} weight="fill" />
        Import Wallet
      </div>
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-text">
        Bring your existing keys
      </h2>
      <p className="text-base text-muted leading-relaxed">
        Restore access using your seed phrase, private key, or backup file.
      </p>
      <ul className="space-y-2 text-muted/80 text-sm">
        <li className="flex gap-3 items-start">
          <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2" />
          <span>Never paste secrets into untrusted devices.</span>
        </li>
        <li className="flex gap-3 items-start">
          <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2" />
          <span>Passphrase here encrypts the wallet on this device only.</span>
        </li>
      </ul>
    </>
  );

  return (
    <AuthLayout hero={Hero}>
      <div className="flex bg-bg/50 p-1 rounded-xl mb-4 border border-white/5">
        <button
          onClick={() => setMode("mnemonic")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all",
            mode === "mnemonic" ? "bg-accent/10 text-accent shadow-sm" : "text-muted hover:text-text hover:bg-white/5"
          )}
        >
          <TextT size={18} /> Mnemonic
        </button>
        <button
          onClick={() => setMode("wif")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all",
            mode === "wif" ? "bg-accent/10 text-accent shadow-sm" : "text-muted hover:text-text hover:bg-white/5"
          )}
        >
          <Key size={18} /> WIF
        </button>
        <button
          onClick={() => setMode("walletjson")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all",
            mode === "walletjson" ? "bg-accent/10 text-accent shadow-sm" : "text-muted hover:text-text hover:bg-white/5"
          )}
        >
          <FileCode size={18} /> JSON
        </button>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase tracking-wider text-muted ml-1">
            {mode === "mnemonic" ? "12-word mnemonic" : mode === "wif" ? "WIF private key" : "wallet.json contents"}
          </label>
          <textarea
            className="w-full px-4 py-3 bg-panel-strong/50 border border-white/5 rounded-xl focus:outline-none focus:ring-2 focus:border-accent/50 focus:ring-accent/20 transition-all placeholder:text-muted/50 resize-y min-h-[80px]"
            required
            placeholder={
              mode === "mnemonic"
                ? "word1 word2 word3 ..."
                : mode === "wif"
                  ? "L1aW4aubDFB7yfras2S1mN3bqg9w7..."
                  : "{ \"seed\": \"...\", \"encrypted\": false, ... }"
            }
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />
        </div>

        <Input
          label="Passphrase"
          type="password"
          required
          placeholder="Encrypt wallet locally"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
        />
        <Input
          label="Confirm"
          type="password"
          required
          placeholder="Repeat passphrase"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={error || undefined}
        />

        <div className="flex flex-col gap-4 mt-2">
          <Button type="submit" loading={busy} size="lg" className="w-full">
            Import Wallet
          </Button>
          <Link to="/create">
            <Button variant="outline" size="lg" className="w-full">Create New Instead</Button>
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
