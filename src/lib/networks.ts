import type { Network } from "bitcoinjs-lib";

export const BASELINE_NETWORK: Network = {
  messagePrefix: "\x18Baseline Signed Message:\n",
  bech32: undefined,
  bip32: {
    public: 0x0488b21e,
    private: 0x0488ade4,
  },
  pubKeyHash: 0x35,
  scriptHash: 0x05,
  wif: 0x80,
};

export const DUST_LIMIT = 550; // liners (0.00000550)
