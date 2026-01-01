import { ECPairFactory, type ECPairInterface } from "ecpair";
import * as tinySecp from "tiny-secp256k1";

import { BASELINE_NETWORK, DUST_LIMIT } from "./networks";

import * as bitcoin from "bitcoinjs-lib";

// Ensure bitcoinjs-lib is wired to tiny-secp256k1 for signing.
bitcoin.initEccLib(tinySecp);

export type SpendableUtxo = {
  txid: string;
  vout: number;
  value: number;
  scriptPubKey: string;
  address: string;
};

export type SpendPlan = {
  selected: SpendableUtxo[];
  change: number;
  fee: number;
};

export type BuildRequest = {
  utxos: SpendableUtxo[];
  toAddress: string;
  amount: number;
  changeAddress: string;
  feeRateLinersPerKb: number;
  lockTime?: number;
};

export type BuildResult = {
  hex: string;
  fee: number;
  vsize: number;
  change: number;
  inputsUsed: number;
  lockTime?: number;
};

export type KeyRing = Record<string, ECPairInterface>;

const ECPair = ECPairFactory(tinySecp);

export function pairFromWif(wif: string): ECPairInterface {
  return ECPair.fromWIF(wif, BASELINE_NETWORK);
}

export function estimateLegacySize(inputCount: number, outputCount: number): number {
  return 10 + inputCount * 148 + outputCount * 34;
}

export function selectUtxos(
  utxos: SpendableUtxo[],
  amount: number,
  feeRateLinersPerKb: number,
): SpendPlan {
  const feeRatePerByte = feeRateLinersPerKb / 1000;
  const sorted = [...utxos].sort((a, b) => b.value - a.value);
  let selected: SpendableUtxo[] = [];
  let total = 0;

  for (const utxo of sorted) {
    selected.push(utxo);
    total += utxo.value;
    let outputs = 1;
    let estFee = Math.ceil(estimateLegacySize(selected.length, outputs) * feeRatePerByte);
    let change = total - amount - estFee;
    outputs = change >= DUST_LIMIT ? 2 : 1;
    estFee = Math.ceil(estimateLegacySize(selected.length, outputs) * feeRatePerByte);
    change = total - amount - estFee;
    if (change >= 0) {
      const changeValue = change >= DUST_LIMIT ? change : 0;
      const fee = total - amount - changeValue;
      return { selected, change: changeValue, fee };
    }
  }

  throw new Error("Insufficient funds for amount + fee");
}

function scriptForAddress(address: string): Buffer {
  const payment = bitcoin.payments.p2pkh({ address, network: BASELINE_NETWORK });
  if (!payment.output) {
    throw new Error(`Unable to derive script for address ${address}`);
  }
  return payment.output;
}

export function buildAndSignTx(request: BuildRequest, keyRing: KeyRing): BuildResult {
  const plan = selectUtxos(request.utxos, request.amount, request.feeRateLinersPerKb);
  const tx = new bitcoin.Transaction();
  tx.locktime = request.lockTime ?? 0;

  for (const utxo of plan.selected) {
    const sequence = request.lockTime !== undefined ? 0xfffffffe : undefined;
    const hash = Buffer.from(utxo.txid, "hex").reverse();
    tx.addInput(hash, utxo.vout, sequence);
  }

  tx.addOutput(scriptForAddress(request.toAddress), request.amount);
  if (plan.change > 0) {
    tx.addOutput(scriptForAddress(request.changeAddress), plan.change);
  }

  plan.selected.forEach((utxo, idx) => {
    const key = keyRing[utxo.address];
    if (!key) {
      throw new Error(`Missing signing key for address ${utxo.address}`);
    }
    const script = utxo.scriptPubKey ? Buffer.from(utxo.scriptPubKey, "hex") : scriptForAddress(utxo.address);
    const hashForSig = tx.hashForSignature(idx, script, bitcoin.Transaction.SIGHASH_ALL);
    const signature = bitcoin.script.signature.encode(key.sign(hashForSig), bitcoin.Transaction.SIGHASH_ALL);
    const scriptSig = bitcoin.script.compile([signature, key.publicKey]);
    tx.setInputScript(idx, scriptSig);
  });

  const hex = tx.toHex();
  const vsize = tx.virtualSize();
  const totalIn = plan.selected.reduce((sum, utxo) => sum + utxo.value, 0);
  const totalOut = request.amount + (plan.change > 0 ? plan.change : 0);
  const fee = totalIn - totalOut;

  return {
    hex,
    fee,
    vsize,
    change: plan.change,
    inputsUsed: plan.selected.length,
    lockTime: request.lockTime,
  };
}
