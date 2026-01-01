import { describe, expect, it } from "vitest";

import { decryptPayload, encryptPayload } from "./storage";

describe("storage encryption", () => {
  it("roundtrips encrypt/decrypt", async () => {
    const payload = { hello: "world", count: 3 };
    const encrypted = await encryptPayload("passphrase", payload);
    const decrypted = await decryptPayload<typeof payload>("passphrase", encrypted);
    expect(decrypted).toEqual(payload);
  });
});
