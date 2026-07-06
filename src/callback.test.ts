import { describe, expect, it } from "vitest";
import { signValidatorCallback, verifyValidatorCallback } from "./callback";

describe("validator callback signatures", () => {
  it("accepts a valid HMAC callback over the exact raw body", async () => {
    const body = JSON.stringify({ validation_attempt_id: 1, media_asset_id: 2, status: "valid" });
    const timestamp = 1_800_000_000;
    const nonce = "0123456789abcdef0123456789abcdef";
    const secret = "test-secret";
    const signature = await signValidatorCallback({ body, secret, timestamp, nonce });

    const result = await verifyValidatorCallback({
      body,
      nowSeconds: timestamp,
      headers: {
        "x-mutual-validator-key-id": "validator-test",
        "x-mutual-validator-timestamp": String(timestamp),
        "x-mutual-validator-nonce": nonce,
        "x-mutual-validator-signature": signature,
      },
      secrets: new Map([["validator-test", secret]]),
      hasSeenNonce: () => false,
    });

    expect(result.ok).toBe(true);
  });

  it("rejects stale timestamps, replayed nonces, and body tampering", async () => {
    const body = JSON.stringify({ validation_attempt_id: 1 });
    const timestamp = 1_800_000_000;
    const nonce = "0123456789abcdef0123456789abcdef";
    const secret = "test-secret";
    const signature = await signValidatorCallback({ body, secret, timestamp, nonce });
    const headers = {
      "x-mutual-validator-key-id": "validator-test",
      "x-mutual-validator-timestamp": String(timestamp),
      "x-mutual-validator-nonce": nonce,
      "x-mutual-validator-signature": signature,
    };

    await expect(
      verifyValidatorCallback({
        body,
        nowSeconds: timestamp + 301,
        headers,
        secrets: new Map([["validator-test", secret]]),
        hasSeenNonce: () => false,
      }),
    ).resolves.toMatchObject({ ok: false, reason: "stale_timestamp" });

    await expect(
      verifyValidatorCallback({
        body,
        nowSeconds: timestamp,
        headers,
        secrets: new Map([["validator-test", secret]]),
        hasSeenNonce: () => true,
      }),
    ).resolves.toMatchObject({ ok: false, reason: "nonce_replay" });

    await expect(
      verifyValidatorCallback({
        body: JSON.stringify({ validation_attempt_id: 2 }),
        nowSeconds: timestamp,
        headers,
        secrets: new Map([["validator-test", secret]]),
        hasSeenNonce: () => false,
      }),
    ).resolves.toMatchObject({ ok: false, reason: "signature_mismatch" });
  });
});
