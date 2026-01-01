import { describe, expect, it } from "vitest";
import * as bitcoin from "bitcoinjs-lib";

import { buildAndSignTx, type SpendableUtxo } from "./tx";
import { buildKeyRing, deriveBatchFromMnemonic, toLiners } from "./wallet";
import { BASELINE_NETWORK } from "./networks";

const mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

describe("transaction building", () => {
  it("builds and signs a P2PKH transaction with change and lockTime", () => {
    const keys = deriveBatchFromMnemonic(mnemonic, 2);
    const keyRing = buildKeyRing(keys);
    const script = bitcoin.payments.p2pkh({ address: keys[0].address, network: BASELINE_NETWORK }).output!;
    const utxos: SpendableUtxo[] = [
      {
        txid: "01".padStart(64, "0"),
        vout: 0,
        value: toLiners(1.5),
        scriptPubKey: script.toString("hex"),
        address: keys[0].address,
      },
    ];

    const build = buildAndSignTx(
      {
        utxos,
        toAddress: keys[1].address,
        amount: toLiners(1),
        changeAddress: keys[0].address,
        feeRateLinersPerKb: 1_000, // 0.00001000 BLINE/kB
        lockTime: 50_000,
      },
      keyRing,
    );

    expect(build.hex).toMatch(/^[0-9a-f]+$/i);
    expect(build.change).toBeGreaterThan(0);
    expect(build.fee).toBeGreaterThan(0);
    expect(build.lockTime).toBe(50_000);

    const tx = bitcoin.Transaction.fromHex(build.hex);
    expect(tx.locktime).toBe(50_000);
    tx.ins.forEach((input) => expect(input.sequence).toBe(0xfffffffe));
    const totalOut = tx.outs.reduce((sum, out) => sum + out.value, 0);
    const totalIn = utxos.reduce((sum, u) => sum + u.value, 0);
    expect(totalIn - totalOut).toBe(build.fee);
  });
});
