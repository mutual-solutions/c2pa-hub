import { createHash } from "node:crypto";

const DEFAULT_MAX_RESULTS = 10;
const DEFAULT_TSA_TRUST_ANCHORS_URL = "https://raw.githubusercontent.com/c2pa-org/conformance-public/refs/heads/main/trust-list/C2PA-TSA-TRUST-LIST.pem";

export function parseSoftBindingResolvers(value) {
  if (!value || !String(value).trim()) return [];
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed)) throw new Error("soft_binding_resolvers_must_be_array");
  return parsed.map((resolver) => normalizeResolver(resolver)).filter(Boolean);
}

export async function recoverSoftBindingManifest({ bytes, mediaUrl, contentType, byteLength, resolvers, fetcher = fetch }) {
  for (const resolver of resolvers) {
    if (resolver.lookup === "byContent") {
      const recovered = await recoverByContent({ bytes, contentType, resolver, fetcher });
      if (recovered) return recovered;
    }
    if (resolver.lookup === "byReference") {
      const recovered = await recoverByReference({ mediaUrl, contentType, byteLength, resolver, fetcher });
      if (recovered) return recovered;
    }
  }
  return null;
}

export function normalizeSoftBindingRecoveryCallback({
  job,
  recovery,
  mediaSha256,
  validatorVersion,
  trustAnchorsUrl,
  tsaTrustAnchorsUrl = DEFAULT_TSA_TRUST_ANCHORS_URL,
  retrievedAt = new Date().toISOString(),
}) {
  return {
    validation_attempt_id: job.validation_attempt_id,
    media_asset_id: job.media_asset_id,
    idempotency_key: job.idempotency_key,
    validator_name: "github-actions-c2patool",
    validator_version: validatorVersion,
    status: "no_manifest",
    trust_status: "not_applicable",
    manifest_present: false,
    signer: null,
    claim_generator: null,
    digital_source_type: null,
    ai_disclosure_present: false,
    actions: [],
    ingredients_count: 0,
    soft_binding: {
      status: recovery.status,
      resolver_name: recovery.resolverName,
      lookup_method: recovery.lookupMethod,
      manifest_id: recovery.manifestId,
      manifest_url: recovery.manifestUrl,
      similarity_score: recovery.similarityScore,
    },
    raw_validator_json: {
      media_sha256: mediaSha256,
      soft_binding: {
        status: recovery.status,
        resolver_name: recovery.resolverName,
        resolver_endpoint: recovery.resolverEndpoint,
        lookup_method: recovery.lookupMethod,
        manifest_endpoint: recovery.manifestEndpoint,
        manifest_id: recovery.manifestId,
        manifest_url: recovery.manifestUrl,
        similarity_score: recovery.similarityScore,
        manifest_content_type: recovery.manifestContentType,
        manifest_byte_length: recovery.manifestByteLength,
        manifest_sha256: recovery.manifestSha256,
      },
    },
    trust_list: {
      version: "c2pa-conformance-public-main",
      ca_source_uri: trustAnchorsUrl,
      tsa_source_uri: tsaTrustAnchorsUrl,
      retrieved_at: retrievedAt,
      ca_sha256: null,
      tsa_sha256: null,
      signature_status: "c2patool_trust_subcommand",
    },
    error_code: "soft_binding_recovered",
    error_detail: null,
  };
}

function normalizeResolver(value) {
  if (!value || typeof value !== "object") return null;
  const endpoint = typeof value.endpoint === "string" ? trimTrailingSlash(value.endpoint) : "";
  if (!endpoint) return null;
  return {
    name: typeof value.name === "string" && value.name.trim() ? value.name.trim() : new URL(endpoint).hostname,
    endpoint,
    alg: typeof value.alg === "string" && value.alg.trim() ? value.alg.trim() : null,
    lookup: value.lookup === "byReference" ? "byReference" : "byContent",
    maxResults: Number.isInteger(value.maxResults) && value.maxResults > 0 ? value.maxResults : DEFAULT_MAX_RESULTS,
  };
}

async function recoverByContent({ bytes, contentType, resolver, fetcher }) {
  const queryUrl = resolverUrl(resolver, "/matches/byContent");
  const response = await fetcher(queryUrl, {
    method: "POST",
    headers: { "content-type": contentType || "application/octet-stream", accept: "application/json" },
    body: bytes,
  });
  if (!response.ok) return null;
  return recoverFromMatchResponse({ response, resolver, lookupMethod: "byContent", fetcher });
}

async function recoverByReference({ mediaUrl, contentType, byteLength, resolver, fetcher }) {
  const queryUrl = resolverUrl(resolver, "/matches/byReference");
  const response = await fetcher(queryUrl, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      referenceUrl: mediaUrl,
      assetLength: byteLength,
      assetType: contentType || undefined,
    }),
  });
  if (!response.ok) return null;
  return recoverFromMatchResponse({ response, resolver, lookupMethod: "byReference", fetcher });
}

async function recoverFromMatchResponse({ response, resolver, lookupMethod, fetcher }) {
  const result = await response.json();
  const match = Array.isArray(result.matches) ? result.matches.find((item) => item?.manifestId) : null;
  if (!match) return null;

  const manifestEndpoint = typeof match.endpoint === "string" && match.endpoint ? trimTrailingSlash(match.endpoint) : resolver.endpoint;
  const manifestId = String(match.manifestId);
  const manifestUrl = `${manifestEndpoint}/manifests/${encodeURIComponent(manifestId)}`;
  const manifestResponse = await fetcher(manifestUrl, { headers: { accept: "application/c2pa,*/*;q=0.5" } });
  if (!manifestResponse.ok) return null;
  const manifestBytes = new Uint8Array(await manifestResponse.arrayBuffer());
  return {
    status: "recovered",
    lookupMethod,
    resolverName: resolver.name,
    resolverEndpoint: resolver.endpoint,
    manifestEndpoint,
    manifestId,
    manifestUrl,
    similarityScore: Number.isFinite(Number(match.similarityScore)) ? Number(match.similarityScore) : null,
    manifestContentType: manifestResponse.headers.get("content-type") || "application/c2pa",
    manifestByteLength: manifestBytes.byteLength,
    manifestSha256: createHash("sha256").update(manifestBytes).digest("hex"),
  };
}

function resolverUrl(resolver, path) {
  const url = new URL(`${resolver.endpoint}${path}`);
  url.searchParams.set("maxResults", String(resolver.maxResults));
  if (resolver.alg) url.searchParams.set("alg", resolver.alg);
  return url.toString();
}

function trimTrailingSlash(value) {
  return value.trim().replace(/\/+$/, "");
}
