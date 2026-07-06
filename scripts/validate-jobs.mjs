import { createHash, createHmac, randomBytes } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { VALIDATOR_USER_AGENT } from "./http-policy.mjs";
import { normalizeSoftBindingRecoveryCallback, parseSoftBindingResolvers, recoverSoftBindingManifest } from "./soft-binding.mjs";
import { isHardFailureCode } from "./validation-status.mjs";

const execFileAsync = promisify(execFile);

const HUB_BASE_URL = process.env.HUB_BASE_URL || "https://c2pa.mutual.solutions";
const PULL_SECRET = process.env.VALIDATOR_PULL_SECRET;
const CALLBACK_SECRET = process.env.VALIDATOR_CALLBACK_SECRET;
const KEY_ID = process.env.VALIDATOR_KEY_ID || "validator-prod-2026-06";
const C2PATOOL_VERSION = process.env.C2PATOOL_VERSION || "0.26.68";
const TRUST_ANCHORS_URL =
  process.env.C2PATOOL_TRUST_ANCHORS ||
  "https://raw.githubusercontent.com/c2pa-org/conformance-public/refs/heads/main/trust-list/C2PA-TRUST-LIST.pem";
const TSA_TRUST_ANCHORS_URL =
  process.env.C2PATOOL_TSA_TRUST_ANCHORS ||
  "https://raw.githubusercontent.com/c2pa-org/conformance-public/refs/heads/main/trust-list/C2PA-TSA-TRUST-LIST.pem";
const MAX_BYTES = Number(process.env.MAX_VALIDATION_BYTES || 30_000_000);
const SOFT_BINDING_RESOLVERS = parseSoftBindingResolvers(process.env.SOFT_BINDING_RESOLVERS || "[]");

export class NoManifestError extends Error {
  constructor(message) {
    super(`no_manifest:${message}`);
    this.name = "NoManifestError";
  }
}

if (isMain(import.meta.url)) await main();

async function main() {
  if (!PULL_SECRET) throw new Error("VALIDATOR_PULL_SECRET is required");
  if (!CALLBACK_SECRET) throw new Error("VALIDATOR_CALLBACK_SECRET is required");

  const jobs = await fetchJobs();
  console.log(JSON.stringify({ event: "jobs_fetched", count: jobs.length }));

  for (const job of jobs) {
    try {
      const payload = await validateJob(job);
      await postCallback(payload);
      console.log(JSON.stringify({ event: "job_validated", media_asset_id: job.media_asset_id, status: payload.status, trust_status: payload.trust_status }));
    } catch (error) {
      const payload = normalizeErrorCallback(job, error);
      await postCallback(payload);
      console.log(JSON.stringify({ event: "job_failed", media_asset_id: job.media_asset_id, error: payload.error_code }));
    }
  }
}

async function fetchJobs() {
  const response = await fetch(`${HUB_BASE_URL}/api/validation-jobs?limit=${encodeURIComponent(process.env.VALIDATION_JOB_LIMIT || "20")}`, {
    headers: {
      "x-mutual-validator-pull-secret": PULL_SECRET,
      accept: "application/json",
      "user-agent": VALIDATOR_USER_AGENT,
    },
  });
  if (!response.ok) throw new Error(`validation_jobs_failed_${response.status}:${(await response.text()).slice(0, 200)}`);
  const body = await response.json();
  return Array.isArray(body.jobs) ? body.jobs : [];
}

export async function validateJob(job, options = {}) {
  requireField(job, "validation_attempt_id");
  requireField(job, "media_asset_id");
  requireField(job, "media_url");
  requireField(job, "idempotency_key");

  const fetchMediaImpl = options.fetchMedia ?? fetchMedia;
  const runC2paTrustImpl = options.runC2paTrust ?? runC2paTrust;
  const recoverSoftBindingManifestImpl = options.recoverSoftBindingManifest ?? recoverSoftBindingManifest;
  const softBindingResolvers = options.softBindingResolvers ?? SOFT_BINDING_RESOLVERS;
  const validatorVersion = options.validatorVersion ?? C2PATOOL_VERSION;
  const trustAnchorsUrl = options.trustAnchorsUrl ?? TRUST_ANCHORS_URL;
  const tsaTrustAnchorsUrl = options.tsaTrustAnchorsUrl ?? TSA_TRUST_ANCHORS_URL;

  const tempDir = join(tmpdir(), `mutual-c2pa-${Date.now()}-${randomBytes(6).toString("hex")}`);
  await mkdir(tempDir, { recursive: true });
  const assetPath = join(tempDir, "asset");
  try {
    const media = await fetchMediaImpl(job.media_url);
    const sha256 = createHash("sha256").update(media.bytes).digest("hex");
    await writeFile(assetPath, media.bytes);
    try {
      const output = await runC2paTrustImpl(assetPath);
      return normalizeCallback(job, output, sha256);
    } catch (error) {
      if (isNoManifestError(error) && softBindingResolvers.length) {
        const recovery = await recoverSoftBindingManifestImpl({
          bytes: media.bytes,
          mediaUrl: job.media_url,
          contentType: media.contentType,
          byteLength: media.byteLength,
          resolvers: softBindingResolvers,
        });
        if (recovery) {
          return normalizeSoftBindingRecoveryCallback({
            job,
            recovery,
            mediaSha256: sha256,
            validatorVersion,
            trustAnchorsUrl,
            tsaTrustAnchorsUrl,
          });
        }
      }
      throw error;
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function fetchMedia(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": VALIDATOR_USER_AGENT,
      accept: "image/*,video/*,application/pdf,*/*;q=0.5",
    },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`fetch_failed_${response.status}`);
  const length = Number(response.headers.get("content-length") || 0);
  if (length > MAX_BYTES) throw new Error("asset_too_large");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_BYTES) throw new Error("asset_too_large");
  return {
    bytes,
    contentType: response.headers.get("content-type") || "application/octet-stream",
    byteLength: bytes.byteLength,
  };
}

export async function runC2paTrust(assetPath) {
  try {
    const { stdout } = await execFileAsync(
      "c2patool",
      [assetPath, "trust", "--trust_anchors", TRUST_ANCHORS_URL],
      { maxBuffer: 20 * 1024 * 1024 },
    );
    return JSON.parse(stdout || "{}");
  } catch (error) {
    const stdout = error && typeof error === "object" && "stdout" in error ? String(error.stdout || "") : "";
    if (stdout.trim()) {
      try {
        return JSON.parse(stdout);
      } catch {
        // Fall through to normalized error.
      }
    }
    const stderr = error && typeof error === "object" && "stderr" in error ? String(error.stderr || "") : "";
    const detail = stderr || String(error);
    if (isExplicitNoManifestMessage(detail)) {
      throw new NoManifestError(detail);
    }
    throw error;
  }
}

function normalizeCallback(job, output, sha256) {
  const activeManifest = activeManifestFromOutput(output);
  const validationStatus = Array.isArray(output.validation_status) ? output.validation_status : [];
  const codes = validationStatus.map((status) => String(status?.code || ""));
  const hardFailure = codes.some(isHardFailureCode);
  const untrusted = codes.some((code) => code.includes("signingCredential.untrusted"));
  const actions = extractActions(activeManifest);
  const digitalSourceType = findDigitalSourceType(activeManifest);
  const aiDisclosure = hasAiDisclosure(activeManifest, digitalSourceType);

  return {
    validation_attempt_id: job.validation_attempt_id,
    media_asset_id: job.media_asset_id,
    idempotency_key: job.idempotency_key,
    validator_name: "github-actions-c2patool",
    validator_version: C2PATOOL_VERSION,
    status: hardFailure ? "invalid" : "valid",
    trust_status: untrusted ? "untrusted" : "trusted",
    manifest_present: Boolean(activeManifest && Object.keys(activeManifest).length),
    signer: firstString([
      activeManifest?.signature_info?.common_name,
      activeManifest?.signature_info?.issuer,
      activeManifest?.signatureInfo?.commonName,
      activeManifest?.signatureInfo?.issuer,
    ]),
    claim_generator: firstString([activeManifest?.claim_generator, activeManifest?.claimGenerator]),
    digital_source_type: digitalSourceType,
    ai_disclosure_present: aiDisclosure,
    actions,
    ingredients_count: Array.isArray(activeManifest?.ingredients) ? activeManifest.ingredients.length : 0,
    raw_validator_json: {
      active_manifest: output.active_manifest || output.activeManifest || null,
      validation_status: validationStatus,
      manifest: {
        title: activeManifest?.title || null,
        format: activeManifest?.format || null,
        claim_generator: activeManifest?.claim_generator || activeManifest?.claimGenerator || null,
        signature_info: activeManifest?.signature_info || activeManifest?.signatureInfo || null,
        assertion_labels: Array.isArray(activeManifest?.assertions) ? activeManifest.assertions.map((assertion) => assertion.label) : [],
        ingredients_count: Array.isArray(activeManifest?.ingredients) ? activeManifest.ingredients.length : 0,
      },
      media_sha256: sha256,
    },
    trust_list: {
      version: "c2pa-conformance-public-main",
      ca_source_uri: TRUST_ANCHORS_URL,
      tsa_source_uri: TSA_TRUST_ANCHORS_URL,
      retrieved_at: new Date().toISOString(),
      ca_sha256: null,
      tsa_sha256: null,
      signature_status: "c2patool_trust_subcommand",
    },
    error_code: hardFailure ? "validator_reported_error" : null,
    error_detail: null,
  };
}

function activeManifestFromOutput(output) {
  if (!output || typeof output !== "object") return {};
  const label = output.active_manifest || output.activeManifest;
  if (label && output.manifests && typeof output.manifests === "object") {
    if (output.manifests[label]) return output.manifests[label];
  }
  if (output.manifests && typeof output.manifests === "object") {
    const first = Object.values(output.manifests)[0];
    if (first && typeof first === "object") return first;
  }
  if (output.claim_generator || output.claimGenerator || output.assertions) return output;
  return {};
}

function normalizeErrorCallback(job, error) {
  const detail = error instanceof Error ? error.message : String(error);
  const lowered = detail.toLowerCase();
  const status = lowered.includes("unsupported") ? "unsupported_format" : lowered.includes("fetch_failed") ? "fetch_failed" : lowered.includes("no_manifest") ? "no_manifest" : "invalid";
  return {
    validation_attempt_id: job.validation_attempt_id,
    media_asset_id: job.media_asset_id,
    idempotency_key: job.idempotency_key,
    validator_name: "github-actions-c2patool",
    validator_version: C2PATOOL_VERSION,
    status,
    trust_status: "not_applicable",
    manifest_present: false,
    signer: null,
    claim_generator: null,
    digital_source_type: null,
    ai_disclosure_present: false,
    actions: [],
    ingredients_count: 0,
    raw_validator_json: {},
    trust_list: {
      version: "c2pa-conformance-public-main",
      ca_source_uri: TRUST_ANCHORS_URL,
      tsa_source_uri: TSA_TRUST_ANCHORS_URL,
      retrieved_at: new Date().toISOString(),
      ca_sha256: null,
      tsa_sha256: null,
      signature_status: "c2patool_trust_subcommand",
    },
    error_code: status,
    error_detail: detail.slice(0, 1000),
  };
}

function isNoManifestError(error) {
  return error instanceof NoManifestError;
}

function isExplicitNoManifestMessage(value) {
  return /no (c2pa )?(claim|manifest) found|no (c2pa )?manifest|claim not found|manifest not found/i.test(value);
}

function isMain(metaUrl) {
  return Boolean(process.argv[1] && fileURLToPath(metaUrl) === process.argv[1]);
}

async function postCallback(payload) {
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = randomBytes(16).toString("hex");
  const signature = createHmac("sha256", CALLBACK_SECRET).update(`${timestamp}.${nonce}.${body}`).digest("base64url");
  const response = await fetch(`${HUB_BASE_URL}/api/validator-callback`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-mutual-validator-key-id": KEY_ID,
      "x-mutual-validator-timestamp": String(timestamp),
      "x-mutual-validator-nonce": nonce,
      "x-mutual-validator-signature": signature,
    },
    body,
  });
  if (!response.ok) throw new Error(`callback_failed_${response.status}:${(await response.text()).slice(0, 300)}`);
}

function extractActions(manifest) {
  const actions = [];
  walk(manifest, (key, value) => {
    if (key === "action" && typeof value === "string") actions.push(value);
  });
  return [...new Set(actions)];
}

function findDigitalSourceType(manifest) {
  let found = null;
  walk(manifest, (key, value) => {
    if (!found && /digitalsourcetype/i.test(key) && typeof value === "string") found = value;
  });
  return found;
}

function hasAiDisclosure(manifest, digitalSourceType) {
  if (/trainedAlgorithmicMedia/i.test(String(digitalSourceType || ""))) return true;
  let found = false;
  walk(manifest, (_key, value) => {
    if (typeof value === "string" && value.includes("c2pa.ai-disclosure")) found = true;
  });
  return found;
}

function walk(value, visitor) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visitor);
    return;
  }
  for (const [key, nestedValue] of Object.entries(value)) {
    visitor(key, nestedValue);
    walk(nestedValue, visitor);
  }
}

function firstString(values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function requireField(value, field) {
  if (!value || value[field] === undefined || value[field] === null || value[field] === "") throw new Error(`${field}_required`);
}
