export interface CallbackSignatureInput {
  body: string;
  secret: string;
  timestamp: number;
  nonce: string;
}

export interface VerifyCallbackInput {
  body: string;
  nowSeconds: number;
  headers: Headers | Record<string, string | undefined>;
  secrets: Map<string, string>;
  hasSeenNonce: (keyId: string, nonce: string) => boolean | Promise<boolean>;
  maxSkewSeconds?: number;
}

export type CallbackVerificationResult =
  | { ok: true; keyId: string; timestamp: number; nonce: string }
  | {
      ok: false;
      reason:
        | "missing_key_id"
        | "unknown_key_id"
        | "missing_timestamp"
        | "stale_timestamp"
        | "missing_nonce"
        | "nonce_replay"
        | "missing_signature"
        | "signature_mismatch";
    };

export async function signValidatorCallback(input: CallbackSignatureInput): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(input.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = `${input.timestamp}.${input.nonce}.${input.body}`;
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signed));
  return base64UrlEncode(new Uint8Array(signature));
}

export async function verifyValidatorCallback(input: VerifyCallbackInput): Promise<CallbackVerificationResult> {
  const keyId = getHeader(input.headers, "x-mutual-validator-key-id");
  if (!keyId) return { ok: false, reason: "missing_key_id" };

  const secret = input.secrets.get(keyId);
  if (!secret) return { ok: false, reason: "unknown_key_id" };

  const rawTimestamp = getHeader(input.headers, "x-mutual-validator-timestamp");
  if (!rawTimestamp) return { ok: false, reason: "missing_timestamp" };

  const timestamp = Number(rawTimestamp);
  if (!Number.isInteger(timestamp)) return { ok: false, reason: "missing_timestamp" };

  const maxSkewSeconds = input.maxSkewSeconds ?? 300;
  if (Math.abs(input.nowSeconds - timestamp) > maxSkewSeconds) {
    return { ok: false, reason: "stale_timestamp" };
  }

  const nonce = getHeader(input.headers, "x-mutual-validator-nonce");
  if (!nonce || nonce.length < 16) return { ok: false, reason: "missing_nonce" };
  if (await input.hasSeenNonce(keyId, nonce)) return { ok: false, reason: "nonce_replay" };

  const signature = getHeader(input.headers, "x-mutual-validator-signature");
  if (!signature) return { ok: false, reason: "missing_signature" };

  const expected = await signValidatorCallback({ body: input.body, secret, timestamp, nonce });
  if (!constantTimeEqual(expected, signature)) {
    return { ok: false, reason: "signature_mismatch" };
  }

  return { ok: true, keyId, timestamp, nonce };
}

function getHeader(headers: Headers | Record<string, string | undefined>, key: string): string | undefined {
  if (headers instanceof Headers) return headers.get(key) ?? undefined;
  return headers[key] ?? headers[key.toLowerCase()];
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const maxLength = Math.max(leftBytes.length, rightBytes.length);
  let diff = leftBytes.length ^ rightBytes.length;
  for (let i = 0; i < maxLength; i += 1) {
    diff |= (leftBytes[i] ?? 0) ^ (rightBytes[i] ?? 0);
  }
  return diff === 0;
}
