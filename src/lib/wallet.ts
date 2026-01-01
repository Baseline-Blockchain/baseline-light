import { payments } from "bitcoinjs-lib";
import { Buffer } from "buffer";
import BIP32Factory from "bip32";
import * as bip39 from "bip39";
import * as ecc from "tiny-secp256k1";
import { crypto as btcCrypto } from "bitcoinjs-lib";

import { BASELINE_NETWORK } from "./networks";
import { pairFromWif, type KeyRing } from "./tx";

export const COIN = 100_000_000;
export const DEFAULT_ADDRESS_BATCH = 5;

export type DerivedKey = {
  address: string;
  wif: string;
  path?: string;
  label?: string;
};

export type WalletSecrets =
  | {
      kind: "mnemonic";
      mnemonic: string;
      nextIndex: number;
      keys: DerivedKey[];
    }
  | {
      kind: "wif";
      keys: DerivedKey[];
    }
  | {
      kind: "baseline-json";
      seedHex: string;
      nextIndex: number;
      keys: DerivedKey[];
    };

export function toLiners(amount: number): number {
  return Math.round(amount * COIN);
}

export function fromLiners(value: number): number {
  return value / COIN;
}

export function deriveBatchFromMnemonic(
  mnemonic: string,
  count: number,
  startIndex = 0,
  account = 0,
): DerivedKey[] {
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error("Invalid mnemonic");
  }
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const bip32 = BIP32Factory(ecc);
  const root = bip32.fromSeed(seed, BASELINE_NETWORK);
  const derived: DerivedKey[] = [];
  for (let i = 0; i < count; i += 1) {
    const index = startIndex + i;
    // Path mirrors a standard BIP44 external chain; adjust coin type if you register one.
    const path = `m/44'/${account}'/0'/0/${index}`;
    const child = root.derivePath(path);
    if (!child.privateKey) {
      throw new Error("Unable to derive private key");
    }
    const { address } = payments.p2pkh({ pubkey: Buffer.from(child.publicKey), network: BASELINE_NETWORK });
    if (!address) {
      throw new Error("Failed to compute address");
    }
    derived.push({
      address,
      wif: child.toWIF(),
      path,
    });
  }
  return derived;
}

export function keyFromWif(wif: string, label?: string): DerivedKey {
  const pair = pairFromWif(wif);
  const { address } = payments.p2pkh({ pubkey: pair.publicKey, network: BASELINE_NETWORK });
  if (!address) {
    throw new Error("Failed to compute address");
  }
  return { address, wif: pair.toWIF(), label };
}

const SECP_N = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");

export function deriveBaselineFromSeed(seedHex: string, count: number, startIndex = 0): DerivedKey[] {
  if (!seedHex || seedHex.length !== 64) {
    throw new Error("Seed must be 32-byte hex from wallet.json");
  }
  const seed = Buffer.from(seedHex, "hex");
  const bip32 = BIP32Factory(ecc);
  const derived: DerivedKey[] = [];
  for (let i = 0; i < count; i += 1) {
    const index = startIndex + i;
    const indexBuf = Buffer.alloc(4);
    indexBuf.writeUInt32BE(index);
    const digest = btcCrypto.sha256(Buffer.concat([seed, indexBuf]));
    const priv = (BigInt(`0x${digest.toString("hex")}`) % (SECP_N - 1n)) + 1n;
    const privBuf = Buffer.from(priv.toString(16).padStart(64, "0"), "hex");
    const key = bip32.fromPrivateKey(privBuf, Buffer.alloc(32), BASELINE_NETWORK);
    const { address } = payments.p2pkh({ pubkey: Buffer.from(key.publicKey), network: BASELINE_NETWORK });
    if (!address) {
      throw new Error("Failed to compute address");
    }
    derived.push({
      address,
      wif: key.toWIF(),
      path: `baseline:${index}`,
    });
  }
  return derived;
}

export function parseWalletJsonSeed(jsonText: string): { seedHex: string; nextIndex: number } {
  let data: any;
  try {
    data = JSON.parse(jsonText);
  } catch {
    throw new Error("Invalid wallet.json (not JSON)");
  }
  if (data.encrypted) {
    throw new Error("Encrypted wallet.json is not supported; unlock via node wallet");
  }
  const seedHex = data.seed;
  if (typeof seedHex !== "string" || seedHex.length !== 64) {
    throw new Error("wallet.json missing seed");
  }
  const nextIndex = Number(data.next_index ?? data.nextIndex ?? 0);
  const addrCount = data.addresses ? Object.keys(data.addresses).length : 0;
  const target = Math.max(nextIndex, addrCount);
  return { seedHex, nextIndex: target };
}

export function buildKeyRing(keys: DerivedKey[]): KeyRing {
  return keys.reduce<KeyRing>((acc, key) => {
    acc[key.address] = pairFromWif(key.wif);
    return acc;
  }, {});
}

export function buildBackupPayload(secrets: WalletSecrets): object {
  if (secrets.kind === "baseline-json") {
    const addresses: Record<string, object> = {};
    secrets.keys.forEach((k, idx) => {
      addresses[k.address] = {
        index: idx,
        watch_only: false,
        label: k.label ?? "",
      };
    });
    return {
      version: 1,
      encrypted: false,
      seed: secrets.seedHex,
      next_index: secrets.nextIndex,
      addresses,
    };
  }
  if (secrets.kind === "mnemonic") {
    return {
      kind: "mnemonic",
      mnemonic: secrets.mnemonic,
      next_index: secrets.nextIndex,
      addresses: secrets.keys.map((k) => ({ address: k.address, path: k.path, label: k.label })),
    };
  }
  return {
    kind: "wif",
    keys: secrets.keys.map((k) => ({ address: k.address, wif: k.wif, label: k.label })),
  };
}
