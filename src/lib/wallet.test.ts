import { describe, expect, it } from "vitest";

import { buildKeyRing, deriveBatchFromMnemonic, deriveBaselineFromSeed, keyFromWif } from "./wallet";

const mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const expectedFirstAddress = "Nfk9TC8B9eXypnBLFgjiyKFBEFyYJXTxb8";
const expectedFirstWif = "L4p2b9VAf8k5aUahF1JCJUzZkgNEAqLfq8DDdQiyAprQAKSbu8hf";
const baselineSeed = "0f0e0d0c0b0a090807060504030201000102030405060708090a0b0c0d0e0f00";
const baselineFirst = "NbczVeGRYn1NYNvstzcSKpoW8LYeBR8CEt";

describe("wallet derivation", () => {
  it("derives deterministic addresses from mnemonic", () => {
    const keys = deriveBatchFromMnemonic(mnemonic, 2);
    expect(keys[0].address).toBe(expectedFirstAddress);
    expect(keys[0].wif).toBe(expectedFirstWif);
    expect(keys[1].address).not.toBe(keys[0].address);
  });

  it("imports WIF and builds key ring", () => {
    const derived = keyFromWif(expectedFirstWif);
    expect(derived.address).toBe(expectedFirstAddress);
    const ring = buildKeyRing([derived]);
    expect(ring[derived.address]).toBeDefined();
  });

  it("derives addresses from baseline wallet seed", () => {
    const keys = deriveBaselineFromSeed(baselineSeed, 2);
    expect(keys[0].address).toBe(baselineFirst);
    expect(keys[1].address).not.toBe(baselineFirst);
  });
});
