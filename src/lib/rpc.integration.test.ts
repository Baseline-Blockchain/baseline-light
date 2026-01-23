import { describe, expect, it } from "vitest";

import { RpcClient } from "./rpc";

const RPC_URL = process.env.BASELINE_RPC_URL || "http://109.104.154.151:8832/";
const RICH_ADDRESS = process.env.BASELINE_TEST_ADDRESS || "NMUrmCNAH5VUrjLSvM4ULu7eNtD1i8qcyK";

const client = new RpcClient({
  url: RPC_URL,
  timeoutMs: 20_000,
});

describe.sequential("RpcClient integration against live node", () => {
  it(
    "fetches blockchain info",
    async () => {
      const info = await client.getBlockchainInfo();
      expect(info.blocks).toBeGreaterThan(0);
      expect(info.headers).toBeGreaterThan(0);
      expect(info.chain).toBeTypeOf("string");
    },
    30_000,
  );

  it(
    "reads address balance with matured/immature fields",
    async () => {
      const balance = await client.getAddressBalance([RICH_ADDRESS]);
      expect(balance.balance_liners).toBeGreaterThanOrEqual(0);
      expect(balance.received_liners).toBeGreaterThanOrEqual(balance.balance_liners);
      if (typeof balance.matured_liners === "number") {
        expect(balance.matured_liners).toBeLessThanOrEqual(balance.balance_liners);
      }
    },
    30_000,
  );

  it(
    "lists UTXOs and txids, and fetches a raw transaction",
    async () => {
      const [utxos, txids] = await Promise.all([
        client.getAddressUtxos([RICH_ADDRESS], 20, 0),
        client.getAddressTxids([RICH_ADDRESS], true, 20, 0),
      ]);

      expect(Array.isArray(utxos)).toBe(true);
      if (utxos.length > 0) {
        const sample = utxos[0];
        expect(sample.address).toBe(RICH_ADDRESS);
        expect(sample.txid).toBeTypeOf("string");
        expect(typeof sample.liners).toBe("number");
      }

      expect(Array.isArray(txids)).toBe(true);
      const firstTxid = txids[0] ? (typeof txids[0] === "string" ? txids[0] : txids[0].txid) : null;
      if (!firstTxid) {
        return; // nothing to assert further if no history was returned
      }

      const raw = await client.getRawTransaction(firstTxid, true);
      expect(raw.txid).toBe(firstTxid);
      expect(Array.isArray(raw.vout)).toBe(true);
    },
    40_000,
  );

  it(
    "estimates smart fee",
    async () => {
      const fee = await client.estimateSmartFee(6);
      expect(typeof fee.feerate).toBe("number");
      expect(fee.blocks).toBe(6);
    },
    30_000,
  );
});
