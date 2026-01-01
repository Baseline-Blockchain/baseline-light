import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as bip39 from "bip39";

import { encryptPayload, decryptPayload, persistEncryptedWallet, loadEncryptedWallet, clearStoredWallet } from "../lib/storage";
import {
  DEFAULT_ADDRESS_BATCH,
  DerivedKey,
  WalletSecrets,
  buildKeyRing,
  buildBackupPayload,
  deriveBatchFromMnemonic,
  deriveBaselineFromSeed,
  keyFromWif,
  parseWalletJsonSeed,
} from "../lib/wallet";
import type { KeyRing } from "../lib/tx";
import { useSettings } from "./settings";

type WalletStatus = "empty" | "locked" | "ready";

type PersistedWallet =
  | {
      kind: "mnemonic";
      mnemonic: string;
      nextIndex: number;
    }
  | {
      kind: "wif";
      keys: DerivedKey[];
    }
  | {
      kind: "baseline-json";
      seedHex: string;
      nextIndex: number;
    };

type WalletContextValue = {
  status: WalletStatus;
  hasWallet: boolean;
  keys: DerivedKey[];
  secrets?: WalletSecrets;
  keyRing?: KeyRing;
  createWallet(passphrase: string): Promise<WalletSecrets>;
  importMnemonic(mnemonic: string, passphrase: string): Promise<WalletSecrets>;
  importWif(wif: string, passphrase: string): Promise<WalletSecrets>;
  importWalletJson(jsonText: string, passphrase: string): Promise<WalletSecrets>;
  unlock(passphrase: string): Promise<void>;
  lock(): void;
  addAddress(): Promise<DerivedKey>;
  clear(): void;
  exportBackup(): string;
};

const WalletContext = createContext<WalletContextValue | null>(null);

function toPersisted(secrets: WalletSecrets): PersistedWallet {
  if (secrets.kind === "mnemonic") {
    return { kind: "mnemonic", mnemonic: secrets.mnemonic, nextIndex: secrets.nextIndex };
  }
  if (secrets.kind === "baseline-json") {
    return { kind: "baseline-json", seedHex: secrets.seedHex, nextIndex: secrets.nextIndex };
  }
  return { kind: "wif", keys: secrets.keys };
}

function runtimeFromPersisted(data: PersistedWallet): WalletSecrets {
  if (data.kind === "mnemonic") {
    const keys = deriveBatchFromMnemonic(data.mnemonic, Math.max(data.nextIndex, DEFAULT_ADDRESS_BATCH));
    return { kind: "mnemonic", mnemonic: data.mnemonic, nextIndex: Math.max(data.nextIndex, keys.length), keys };
  }
  if (data.kind === "baseline-json") {
    const count = Math.max(DEFAULT_ADDRESS_BATCH, data.nextIndex);
    const keys = deriveBaselineFromSeed(data.seedHex, count);
    return { kind: "baseline-json", seedHex: data.seedHex, nextIndex: count, keys };
  }
  return { kind: "wif", keys: data.keys };
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { client } = useSettings();
  const [status, setStatus] = useState<WalletStatus>("empty");
  const [secrets, setSecrets] = useState<WalletSecrets | undefined>();
  const [sessionPassphrase, setSessionPassphrase] = useState<string | undefined>();
  const [keys, setKeys] = useState<DerivedKey[]>([]);

  useEffect(() => {
    const encrypted = loadEncryptedWallet();
    if (encrypted) {
      setStatus("locked");
    }
  }, []);

  const keyRing = useMemo(() => buildKeyRing(keys), [keys]);

  async function persist(secretsToPersist: WalletSecrets, passphrase?: string) {
    const phrase = passphrase || sessionPassphrase;
    if (!phrase) {
      throw new Error("Passphrase required to persist wallet changes");
    }
    const encrypted = await encryptPayload(phrase, toPersisted(secretsToPersist));
    persistEncryptedWallet(encrypted);
  }

  async function createWallet(passphrase: string): Promise<WalletSecrets> {
    const mnemonic = bip39.generateMnemonic(128);
    const derived = deriveBatchFromMnemonic(mnemonic, DEFAULT_ADDRESS_BATCH);
    const runtime: WalletSecrets = { kind: "mnemonic", mnemonic, nextIndex: DEFAULT_ADDRESS_BATCH, keys: derived };
    const encrypted = await encryptPayload(passphrase, toPersisted(runtime));
    persistEncryptedWallet(encrypted);
    setSecrets(runtime);
    setKeys(runtime.keys);
    setStatus("ready");
    setSessionPassphrase(passphrase);
    return runtime;
  }

  async function importMnemonic(mnemonic: string, passphrase: string): Promise<WalletSecrets> {
    const normalized = mnemonic.trim().toLowerCase();
    if (!bip39.validateMnemonic(normalized)) {
      throw new Error("Mnemonic is not valid");
    }
    const derived = deriveBatchFromMnemonic(normalized, DEFAULT_ADDRESS_BATCH);
    const runtime: WalletSecrets = { kind: "mnemonic", mnemonic: normalized, nextIndex: DEFAULT_ADDRESS_BATCH, keys: derived };
    const encrypted = await encryptPayload(passphrase, toPersisted(runtime));
    persistEncryptedWallet(encrypted);
    setSecrets(runtime);
    setKeys(runtime.keys);
    setStatus("ready");
    setSessionPassphrase(passphrase);
    return runtime;
  }

  async function importWif(wif: string, passphrase: string): Promise<WalletSecrets> {
    const key = keyFromWif(wif.trim());
    const runtime: WalletSecrets = { kind: "wif", keys: [key] };
    const encrypted = await encryptPayload(passphrase, toPersisted(runtime));
    persistEncryptedWallet(encrypted);
    setSecrets(runtime);
    setKeys(runtime.keys);
    setStatus("ready");
    setSessionPassphrase(passphrase);
    return runtime;
  }

  async function importWalletJson(jsonText: string, passphrase: string): Promise<WalletSecrets> {
    const parsed = parseWalletJsonSeed(jsonText);
    const count = Math.max(DEFAULT_ADDRESS_BATCH, parsed.nextIndex || DEFAULT_ADDRESS_BATCH);
    const derived = deriveBaselineFromSeed(parsed.seedHex, count);
    const runtime: WalletSecrets = {
      kind: "baseline-json",
      seedHex: parsed.seedHex,
      nextIndex: count,
      keys: derived,
    };
    const encrypted = await encryptPayload(passphrase, toPersisted(runtime));
    persistEncryptedWallet(encrypted);
    setSecrets(runtime);
    setKeys(runtime.keys);
    setStatus("ready");
    setSessionPassphrase(passphrase);
    return runtime;
  }

  async function unlock(passphrase: string): Promise<void> {
    const encrypted = loadEncryptedWallet();
    if (!encrypted) {
      setStatus("empty");
      return;
    }
    const data = await decryptPayload<PersistedWallet>(passphrase, encrypted);
    const runtime = runtimeFromPersisted(data);
    setSecrets(runtime);
    setKeys(runtime.keys);
    setStatus("ready");
    setSessionPassphrase(passphrase);
  }

  function lock() {
    setStatus("locked");
    setSecrets(undefined);
    setKeys([]);
    setSessionPassphrase(undefined);
  }

  async function addAddress(): Promise<DerivedKey> {
    if (!secrets) {
      throw new Error("Unlock wallet first");
    }
    if (secrets.kind === "wif") {
      throw new Error("Cannot derive additional addresses for imported WIF");
    }
    const nextIndex = secrets.nextIndex ?? secrets.keys.length;
    let newKey: DerivedKey;
    if (secrets.kind === "mnemonic") {
      [newKey] = deriveBatchFromMnemonic(secrets.mnemonic, 1, nextIndex);
    } else {
      [newKey] = deriveBaselineFromSeed(secrets.seedHex, 1, nextIndex);
    }
    const updated: WalletSecrets =
      secrets.kind === "mnemonic"
        ? {
            ...secrets,
            nextIndex: nextIndex + 1,
            keys: [...secrets.keys, newKey],
          }
        : {
            kind: "baseline-json",
            seedHex: secrets.seedHex,
            nextIndex: nextIndex + 1,
            keys: [...secrets.keys, newKey],
          };
    setSecrets(updated);
    setKeys(updated.keys);
    await persist(updated);
    return newKey;
  }

  function clear() {
    clearStoredWallet();
    setStatus("empty");
    setSecrets(undefined);
    setKeys([]);
    setSessionPassphrase(undefined);
  }

  function exportBackup(): string {
    if (!secrets) {
      throw new Error("Unlock wallet first");
    }
    return JSON.stringify(buildBackupPayload(secrets), null, 2);
  }

  const value: WalletContextValue = {
    status,
    hasWallet: status !== "empty" || Boolean(loadEncryptedWallet()),
    keys,
    secrets,
    keyRing: keys.length ? keyRing : undefined,
    createWallet,
    importMnemonic,
    importWif,
    importWalletJson,
    unlock,
    lock,
    addAddress,
    clear,
    exportBackup,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used inside WalletProvider");
  }
  return ctx;
}
