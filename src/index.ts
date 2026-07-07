import { verifyValidatorCallback } from "./callback";
import { classifyC2paEvidence } from "./c2pa";
import { candidatesFromUrls, extractLinkedInC2paClaims, extractMediaCandidates, isLikelyMediaUrl } from "./crawl";
import type { LinkedInC2paClaim, MediaCandidate, PlatformCategoryHint } from "./crawl";
import type { DiscoveryInput } from "./discovery";
import { planDiscoveryBatch } from "./discovery";
import { encodeCursor, parseAssetQuery, serializeCsv } from "./export";
import type { AssetQuery } from "./export";
import { listC2paPublicTestImages, listContentAuthConformanceToolCliAssets, listContentAuthExampleAssets, listProofmodeSampleMedia, listRepositoryMediaUrls } from "./repositories";
import { evaluateRobotsTxt, robotsUrlFor } from "./robots";
import { validatePublicHttpUrl } from "./safety";
import { normalizeValidation } from "./taxonomy";
import type { NormalizedValidation } from "./taxonomy";
import { renderAssetsLibrary, renderHome, renderLandscape, renderMethodology, renderResources, renderTrust } from "./ui";
import type { TrustData, TrustProduct } from "./ui";

type RuntimeEnv = Env & {
  VALIDATOR_CALLBACK_SECRET?: string;
  BRAVE_SEARCH_API_KEY?: string;
  CONTEXT_API_KEY?: string;
  VALIDATOR_PULL_SECRET?: string;
};

export class C2paValidatorContainer implements DurableObject {
  async fetch(): Promise<Response> {
    return json({ error: "validator_container_retired", replacement: "github_actions_c2patool" }, 410);
  }
}

interface QueueMessage {
  stage?: "discovery" | "fetch" | "validate";
  crawl_run_id?: number;
  source?: {
    sourceType: string;
    value: string;
    provider: string;
    ordinal: number;
  };
  media_asset_id?: number;
  media_url?: string;
}

interface PlatformClaimMetadata {
  platformClaimSource: string | null;
  platformClaimApp: string | null;
  platformClaimIssuedBy: string | null;
  platformClaimIssuedAt: string | null;
  platformClaimAiDisclosure: string | null;
  platformClaimCategoryHint: PlatformCategoryHint | null;
  platformClaimJson: string | null;
}

const USER_AGENT = "mutual-c2pa-hub/0.2 (+https://c2pa.mutual.solutions/methodology)";
const BROWSER_IMAGE_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";
const PREFILTER_BYTES = 2_000_000;
const KNOWN_REPOSITORY_CANDIDATE_LIMIT = 2000;
const IMAGE_PROXY_MAX_BYTES = 12_000_000;
const MUTUAL_SOFT_BINDING_CONTENT_ALG = "com.mutual.sha256.v1";
const MUTUAL_SOFT_BINDING_REFERENCE_ALG = "com.mutual.reference-url.v1";
const HACKER_FACTOR_PIXEL_10_POST = "https://www.hackerfactor.com/blog/index.php?/archives/1077-Google-Pixel-10-and-Massive-C2PA-Failures.html";
const CONTEXT_ALLOWLISTED_FOTOF_FORENSICS_ORIGINALS = new Set([
  "https://fotoforensics.com/analysis.php?id=8204a32ac89368dccb181692c0ed8ea9cc7cb6be.1490652&fmt=orig",
  "https://fotoforensics.com/analysis.php?id=615cc64715bc8ffe1e69f5eb5e7c1a57be6decfe.3508225&fmt=orig",
  "https://fotoforensics.com/analysis.php?id=f975c4dd9c55064c21af70749d1ec5756f8ab7f4.3227167&fmt=orig",
]);

export default {
  async fetch(request: Request, env: RuntimeEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    try {
      if (request.method === "GET" && url.pathname === "/") return html(renderHome());
      if (request.method === "GET" && url.pathname === "/methodology") return html(renderMethodology(env.METHODOLOGY_VERSION));
      if (request.method === "GET" && url.pathname === "/landscape") return landscapePage(env);
      if (request.method === "GET" && url.pathname === "/assets") return assetsLibraryPage(url, env);
      if (request.method === "GET" && url.pathname === "/resources") return html(renderResources());
      if (request.method === "GET" && url.pathname === "/trust") return html(renderTrust(await loadTrustData(env)));
      if (request.method === "GET" && url.pathname === "/api/trust-changes") return trustChangesFeed(env);
      if (request.method === "GET" && url.pathname === "/api/history") return historyFeed(env, ctx);
      if (request.method === "GET" && url.pathname === "/api/methodology") return json(methodology(env));
      if (request.method === "GET" && url.pathname === "/api/assets") return listAssets(url, env);
      if (request.method === "GET" && url.pathname.startsWith("/api/assets/")) return getAsset(url, env);
      if (request.method === "GET" && url.pathname === "/api/stats") return corpusStats(env);
      if (request.method === "GET" && url.pathname === "/api/export.json") return exportJson(url, env);
      if (request.method === "GET" && url.pathname === "/api/export.csv") return exportCsv(url, env);
      if (request.method === "GET" && url.pathname.startsWith("/api/image/")) return proxyCorpusImage(request, env);
      if (request.method === "GET" && url.pathname === "/api/recent") return recent(env);
      if (request.method === "GET" && url.pathname === "/api/crawl-runs") return listCrawlRuns(env);
      if (request.method === "POST" && url.pathname === "/api/crawl-runs") return createCrawlRun(request, env, ctx);
      if (request.method === "POST" && url.pathname === "/api/scan") return scanCompatibility(request, env, ctx);
      if (request.method === "GET" && url.pathname === "/api/validation-jobs") return validationJobs(request, env);
      if (request.method === "POST" && url.pathname === "/api/validator-callback") return validatorCallback(request, env);
      if (url.pathname.startsWith("/soft-binding/")) return softBindingResolver(request, env);
      if (request.method === "POST" && url.pathname === "/mcp/query") return mcpQuery(request, env);
      if (request.method === "POST" && url.pathname === "/mcp") return mcpJsonRpc(request, env, ctx);
      return json({ error: "not_found" }, 404);
    } catch (error) {
      const message = error instanceof Error ? error.message : "internal_error";
      console.error(JSON.stringify({ event: "request_error", path: url.pathname, message }));
      return json({ error: "internal_error", detail: message }, 500);
    }
  },

  async queue(batch: MessageBatch<QueueMessage>, env: RuntimeEnv, ctx: ExecutionContext): Promise<void> {
    for (const message of batch.messages) {
      ctx.waitUntil(handleQueueMessage(message.body, env).then(() => message.ack()).catch((error) => {
        console.error(JSON.stringify({ event: "queue_error", error: String(error) }));
        message.retry();
      }));
    }
  },

  async scheduled(_controller: ScheduledController, env: RuntimeEnv, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(scheduleBroadDiscovery(env, ctx));
    ctx.waitUntil(ensureDailySnapshot(env).catch(() => undefined));
  },
} satisfies ExportedHandler<RuntimeEnv, QueueMessage>;

async function listAssets(url: URL, env: RuntimeEnv): Promise<Response> {
  const parsed = parseAssetQuery(url);
  if (!parsed.ok) return json({ error: parsed.reason }, 400);

  const { sql, params } = buildAssetQuery(parsed.query);
  const rows = await env.DB.prepare(sql).bind(...params).all();
  const assets = (rows.results ?? []) as Array<Record<string, unknown>>;
  const last = assets.at(-1);

  return json({
    methodology_version: env.METHODOLOGY_VERSION,
    limit: parsed.query.limit,
    limit_clamped: parsed.query.limitClamped,
    filters: {
      q: parsed.query.q ?? null,
      category: parsed.query.category ?? null,
      domain: parsed.query.domain ?? null,
      signer: parsed.query.signer ?? null,
      generator: parsed.query.generator ?? null,
      classification: parsed.query.classification ?? null,
      include_excluded_ai: parsed.query.includeExcludedAi,
      include_diagnostics: parsed.query.includeDiagnostics,
    },
    assets,
    next_cursor:
      assets.length === parsed.query.limit && last?.latest_validated_at && Number.isInteger(last.id)
        ? encodeCursor({ validatedAt: String(last.latest_validated_at), mediaAssetId: Number(last.id) })
        : null,
  });
}

async function getAsset(url: URL, env: RuntimeEnv): Promise<Response> {
  const idPart = url.pathname.split("/").at(-1) ?? "";
  if (!/^[1-9]\d*$/.test(idPart) || !Number.isSafeInteger(Number(idPart))) return json({ error: "invalid_id" }, 400);
  const id = Number(idPart);

  const row = await env.DB.prepare(
    "select * from media_assets where id = ? and public_category in ('real','edited')",
  )
    .bind(id)
    .first();

  if (!row) return json({ error: "not_found" }, 404);

  const attempt = await env.DB.prepare(
    "select actions_json, ingredients_count from validation_attempts where media_asset_id = ? order by id desc limit 1",
  )
    .bind(id)
    .first<{ actions_json: string | null; ingredients_count: number | null }>();

  let actions: string[] = [];
  try {
    const parsed = JSON.parse(attempt?.actions_json ?? "[]");
    if (Array.isArray(parsed)) actions = parsed.map(String);
  } catch {
    actions = [];
  }

  return json({
    methodology_version: env.METHODOLOGY_VERSION,
    asset: { ...(row as Record<string, unknown>), actions, ingredients_count: attempt?.ingredients_count ?? 0 },
  });
}

const CONFORMANCE_REPO = "c2pa-org/conformance-public";
const TRUST_LIST_URL = `https://raw.githubusercontent.com/${CONFORMANCE_REPO}/main/trust-list/C2PA-TRUST-LIST.pem`;
const TSA_LIST_URL = `https://raw.githubusercontent.com/${CONFORMANCE_REPO}/main/trust-list/C2PA-TSA-TRUST-LIST.pem`;
const PRODUCTS_URL = `https://raw.githubusercontent.com/${CONFORMANCE_REPO}/main/conforming-products/conforming-products-list.json`;
const TRUST_COMMITS_URL = `https://github.com/${CONFORMANCE_REPO}/commits/main/trust-list.atom`;
const PRODUCT_COMMITS_URL = `https://github.com/${CONFORMANCE_REPO}/commits/main/conforming-products.atom`;

async function cachedUpstreamText(url: string, ttlSeconds: number): Promise<string | null> {
  const cache = typeof caches !== "undefined" ? caches.default : null;
  const cacheKey = new Request(url, { headers: { accept: "text/plain" } });
  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit.text();
  }
  try {
    const response = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "application/vnd.github+json, application/json;q=0.9, */*;q=0.8" },
    });
    if (!response.ok) return null;
    const body = await response.text();
    if (cache) {
      await cache.put(cacheKey, new Response(body, { headers: { "cache-control": `public, max-age=${ttlSeconds}` } }));
    }
    return body;
  } catch {
    return null;
  }
}

function countCertificates(pem: string | null): number | null {
  if (!pem) return null;
  return (pem.match(/BEGIN CERTIFICATE/g) ?? []).length;
}

async function loadTrustData(env: RuntimeEnv): Promise<TrustData> {
  const [trustPem, tsaPem, productsRaw, commitsRaw, productCommitsRaw, signerRows] = await Promise.all([
    cachedUpstreamText(TRUST_LIST_URL, 3600),
    cachedUpstreamText(TSA_LIST_URL, 3600),
    cachedUpstreamText(PRODUCTS_URL, 3600),
    cachedUpstreamText(TRUST_COMMITS_URL, 3600),
    cachedUpstreamText(PRODUCT_COMMITS_URL, 3600),
    env.DB.prepare("select signer, classification, count(*) as n from media_assets where signer is not null group by signer, classification").all(),
  ]);

  const observed = new Map<string, { trusted: number; untrusted: number; invalid: number }>();
  for (const row of (signerRows.results ?? []) as Array<Record<string, unknown>>) {
    const name = String(row.signer).toLowerCase();
    const bucket = observed.get(name) ?? { trusted: 0, untrusted: 0, invalid: 0 };
    const classification = String(row.classification);
    const n = Number(row.n) || 0;
    if (classification === "trusted_camera_capture" || classification === "trusted_edited" || classification === "ai_disclosed") bucket.trusted += n;
    else if (classification === "c2pa_invalid") bucket.invalid += n;
    else bucket.untrusted += n;
    observed.set(name, bucket);
  }

  let products: TrustProduct[] = [];
  try {
    const parsed = JSON.parse(productsRaw ?? "[]");
    if (Array.isArray(parsed)) {
      products = parsed
        .map((record: Record<string, any>): TrustProduct => {
          const cn = String(record?.product?.DN?.CN ?? "");
          const totals = { trusted: 0, untrusted: 0, invalid: 0 };
          if (cn) {
            const needle = cn.toLowerCase();
            for (const [signer, bucket] of observed) {
              if (signer === needle || signer.includes(needle) || needle.includes(signer)) {
                totals.trusted += bucket.trusted;
                totals.untrusted += bucket.untrusted;
                totals.invalid += bucket.invalid;
              }
            }
          }
          return {
            cn: cn || "(unnamed)",
            applicant: String(record?.applicant ?? ""),
            productType: String(record?.product?.productType ?? ""),
            assurance: record?.product?.assurance?.maxAssuranceLevel ?? null,
            spec: Array.isArray(record?.specVersion) ? record.specVersion.join(", ") : String(record?.specVersion ?? ""),
            since: String(record?.dates?.conformance ?? ""),
            status: String(record?.status ?? ""),
            observedTrusted: totals.trusted,
            observedUntrusted: totals.untrusted,
            observedInvalid: totals.invalid,
          };
        })
        .sort((a, b) => (b.since || "").localeCompare(a.since || ""));
    }
  } catch {
    products = [];
  }

  const changes = parseAtomChanges(commitsRaw);
  const productChanges = parseAtomChanges(productCommitsRaw);

  return {
    sourceOk: Boolean(productsRaw && commitsRaw),
    trustCertCount: countCertificates(trustPem),
    tsaCertCount: countCertificates(tsaPem),
    changes,
    productChanges,
    products,
  };
}

function parseAtomChanges(xml: string | null): TrustData["changes"] {
  const changes: TrustData["changes"] = [];
  for (const entry of (xml ?? "").split("<entry>").slice(1)) {
    const title = entry.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
    const updated = entry.match(/<updated>([^<]*)<\/updated>/)?.[1] ?? "";
    const link = entry.match(/href="([^"]*)"/)?.[1] ?? "";
    if (updated) changes.push({ date: updated, message: title.trim(), url: link });
  }
  return changes;
}

async function ensureDailySnapshot(env: RuntimeEnv): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const existing = await env.DB.prepare("select id from stats_snapshots where snapshot_date = ?").bind(today).first();
  if (existing) return;

  const [classifications, meta, trustPem, tsaPem, productsRaw] = await Promise.all([
    env.DB.prepare("select classification, count(*) as n from media_assets group by classification").all(),
    env.DB.prepare("select count(*) as total, count(distinct domain) as domains, min(created_at) as first_seen, max(created_at) as last_seen from media_assets").first(),
    cachedUpstreamText(TRUST_LIST_URL, 3600),
    cachedUpstreamText(TSA_LIST_URL, 3600),
    cachedUpstreamText(PRODUCTS_URL, 3600),
  ]);

  const counts: Record<string, number> = {};
  for (const row of (classifications.results ?? []) as Array<Record<string, unknown>>) {
    counts[String(row.classification)] = Number(row.n) || 0;
  }
  let productCount: number | null = null;
  try {
    const parsed = JSON.parse(productsRaw ?? "null");
    if (Array.isArray(parsed)) productCount = parsed.length;
  } catch {
    productCount = null;
  }
  const metaRow = (meta ?? {}) as Record<string, unknown>;

  await env.DB.prepare(
    `insert or ignore into stats_snapshots
     (snapshot_date, total_assets, domains, classification_counts, trust_cert_count, tsa_cert_count, conforming_product_count, methodology_version)
     values (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      today,
      Number(metaRow.total) || 0,
      Number(metaRow.domains) || 0,
      JSON.stringify(counts),
      countCertificates(trustPem),
      countCertificates(tsaPem),
      productCount,
      env.METHODOLOGY_VERSION,
    )
    .run();
}

async function historyFeed(env: RuntimeEnv, ctx: ExecutionContext): Promise<Response> {
  ctx.waitUntil(ensureDailySnapshot(env).catch(() => undefined));
  const rows = await env.DB.prepare(
    "select snapshot_date, total_assets, domains, classification_counts, trust_cert_count, tsa_cert_count, conforming_product_count, methodology_version from stats_snapshots order by snapshot_date desc limit 400",
  ).all();
  return json({
    snapshots: ((rows.results ?? []) as Array<Record<string, unknown>>).map((row) => {
      let counts: unknown = {};
      try {
        counts = JSON.parse(String(row.classification_counts ?? "{}"));
      } catch {
        counts = {};
      }
      return { ...row, classification_counts: counts };
    }),
  });
}

async function trustChangesFeed(env: RuntimeEnv): Promise<Response> {
  const data = await loadTrustData(env);
  return json({
    source: `https://github.com/${CONFORMANCE_REPO}`,
    source_ok: data.sourceOk,
    trust_cert_count: data.trustCertCount,
    tsa_cert_count: data.tsaCertCount,
    conforming_product_count: data.products.length,
    changes: data.changes,
    product_changes: data.productChanges,
  });
}

async function assetsLibraryPage(url: URL, env: RuntimeEnv): Promise<Response> {
  const signerFilter = url.searchParams.get("signer");
  const categoryParam = url.searchParams.get("category");
  const category = categoryParam === "real" || categoryParam === "edited" ? categoryParam : null;

  const where = ["public_category in ('real','edited')"];
  const params: unknown[] = [];
  if (category) {
    where.push("public_category = ?");
    params.push(category);
  }
  if (signerFilter) {
    where.push("signer = ?");
    params.push(signerFilter);
  }

  const [rows, signerRows] = await Promise.all([
    env.DB.prepare(
      `select id, url, domain, public_category, classification, signer, claim_generator, content_type, latest_validated_at, cached_object_key
       from media_assets where ${where.join(" and ")}
       order by latest_validated_at desc, id desc limit 60`,
    )
      .bind(...params)
      .all(),
    env.DB.prepare("select signer, classification, count(*) as n from media_assets where signer is not null group by signer, classification").all(),
  ]);

  const allowedClasses =
    category === "real"
      ? new Set(["trusted_camera_capture"])
      : category === "edited"
        ? new Set(["trusted_edited"])
        : TRUSTED_PUBLIC_CLASSES;
  const signerTotals = new Map<string, number>();
  for (const row of (signerRows.results ?? []) as Array<Record<string, unknown>>) {
    if (!allowedClasses.has(String(row.classification))) continue;
    const name = String(row.signer);
    signerTotals.set(name, (signerTotals.get(name) ?? 0) + (Number(row.n) || 0));
  }
  const signers = [...signerTotals.entries()]
    .map(([signer, n]) => ({ signer, n }))
    .sort((a, b) => b.n - a.n);

  return html(
    renderAssetsLibrary(
      ((rows.results ?? []) as Array<Record<string, unknown>>).map((row) => ({
        id: Number(row.id),
        url: String(row.url ?? ""),
        domain: row.domain ? String(row.domain) : null,
        public_category: String(row.public_category ?? "real"),
        classification: row.classification ? String(row.classification) : null,
        signer: row.signer ? String(row.signer) : null,
        claim_generator: row.claim_generator ? String(row.claim_generator) : null,
        content_type: row.content_type ? String(row.content_type) : null,
        latest_validated_at: row.latest_validated_at ? String(row.latest_validated_at) : null,
        cached_object_key: row.cached_object_key ? String(row.cached_object_key) : null,
      })),
      signers,
      { signer: signerFilter, category },
    ),
  );
}

const TRUSTED_PUBLIC_CLASSES = new Set(["trusted_camera_capture", "trusted_edited"]);

async function landscapePage(env: RuntimeEnv): Promise<Response> {
  const [classifications, signers, meta] = await Promise.all([
    env.DB.prepare("select classification, count(*) as n from media_assets group by classification").all(),
    env.DB.prepare("select signer, classification, count(*) as n from media_assets where signer is not null group by signer, classification").all(),
    env.DB.prepare("select count(*) as total, count(distinct domain) as domains, min(created_at) as first_seen, max(created_at) as last_seen from media_assets").first(),
  ]);

  const metaRow = (meta ?? {}) as Record<string, unknown>;
  return html(
    renderLandscape({
      total: Number(metaRow.total) || 0,
      domains: Number(metaRow.domains) || 0,
      firstSeen: metaRow.first_seen ? String(metaRow.first_seen) : null,
      lastSeen: metaRow.last_seen ? String(metaRow.last_seen) : null,
      classifications: ((classifications.results ?? []) as Array<Record<string, unknown>>).map((row) => ({
        classification: String(row.classification ?? ""),
        n: Number(row.n) || 0,
      })),
      signers: ((signers.results ?? []) as Array<Record<string, unknown>>).map((row) => ({
        signer: String(row.signer ?? ""),
        classification: String(row.classification ?? ""),
        n: Number(row.n) || 0,
      })),
    }),
  );
}

async function corpusStats(env: RuntimeEnv): Promise<Response> {
  const rows = await env.DB.prepare(
    "select public_category, count(*) as n, max(latest_validated_at) as last_validated_at from media_assets where public_category in ('real', 'edited') group by public_category",
  ).all();

  const stats = { real_count: 0, edited_count: 0, last_validated_at: null as string | null };
  for (const row of (rows.results ?? []) as Array<Record<string, unknown>>) {
    if (row.public_category === "real") stats.real_count = Number(row.n) || 0;
    if (row.public_category === "edited") stats.edited_count = Number(row.n) || 0;
    const last = row.last_validated_at ? String(row.last_validated_at) : null;
    if (last && (!stats.last_validated_at || last > stats.last_validated_at)) stats.last_validated_at = last;
  }

  return json({ methodology_version: env.METHODOLOGY_VERSION, ...stats });
}

async function exportJson(url: URL, env: RuntimeEnv): Promise<Response> {
  const parsed = parseAssetQuery(url);
  if (!parsed.ok) return json({ error: parsed.reason }, 400);

  const { sql, params } = buildAssetQuery(parsed.query);
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return json({
    methodology_version: env.METHODOLOGY_VERSION,
    generated_at: new Date().toISOString(),
    limit: parsed.query.limit,
    limit_clamped: parsed.query.limitClamped,
    ai_generated_publicly_excluded: !parsed.query.includeExcludedAi,
    rows: rows.results ?? [],
    trust_list_artifact_policy: "validator attempts store CA/TSA source URIs, retrieval timestamps, SHA-256 hashes, and signature/check status.",
  });
}

async function exportCsv(url: URL, env: RuntimeEnv): Promise<Response> {
  const parsed = parseAssetQuery(url);
  if (!parsed.ok) return json({ error: parsed.reason }, 400);

  const { sql, params } = buildAssetQuery(parsed.query);
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return new Response(serializeCsv((rows.results ?? []) as Array<Record<string, unknown>>), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="mutual-c2pa-assets.csv"',
      "cache-control": "no-store",
    },
  });
}

async function proxyCorpusImage(request: Request, env: RuntimeEnv): Promise<Response> {
  const id = Number(new URL(request.url).pathname.split("/").at(-1));
  if (!Number.isSafeInteger(id) || id <= 0) return json({ error: "invalid_image_id" }, 400);

  const asset = await env.DB.prepare(
    `select id, url, content_type, cached_object_key, cached_content_type
     from media_assets
     where id = ?`,
  )
    .bind(id)
    .first<{ id: number; url: string; content_type: string | null; cached_object_key: string | null; cached_content_type: string | null }>();
  if (!asset) return json({ error: "not_found" }, 404);

  const cachedKey = asset.cached_object_key || mediaAssetObjectKey(asset.id);
  const cached = await env.ASSETS.get(cachedKey);
  if (cached) {
    const headers = new Headers({ "cache-control": "public, max-age=86400" });
    cached.writeHttpMetadata(headers);
    if (!headers.get("content-type")) headers.set("content-type", asset.cached_content_type || asset.content_type || "application/octet-stream");
    return new Response(await cached.arrayBuffer(), { headers });
  }

  const safe = validatePublicHttpUrl(asset.url);
  if (!safe.ok) return json({ error: safe.reason }, 400);
  const response = await fetch(safe.url.toString(), {
    headers: mediaFetchHeaders(safe.url, "image/*,*/*;q=0.5"),
    redirect: "follow",
  });
  if (!response.ok) return json({ error: "image_fetch_failed", status: response.status }, 502);

  const length = Number(response.headers.get("content-length") || 0);
  if (length > IMAGE_PROXY_MAX_BYTES) return json({ error: "image_too_large" }, 413);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > IMAGE_PROXY_MAX_BYTES) return json({ error: "image_too_large" }, 413);

  const contentType = inferMediaContentType(bytes, response.headers.get("content-type") || asset.content_type || "application/octet-stream");
  if (!contentType.startsWith("image/")) return json({ error: "not_image" }, 415);

  await env.ASSETS.put(cachedKey, bytes, { httpMetadata: { contentType } });
  await env.DB.prepare("update media_assets set cached_object_key = ?, cached_content_type = ?, cached_at = ?, updated_at = ? where id = ?")
    .bind(cachedKey, contentType, new Date().toISOString(), new Date().toISOString(), asset.id)
    .run();

  return new Response(bytes, {
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=86400",
    },
  });
}

async function softBindingResolver(request: Request, env: RuntimeEnv): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/soft-binding/services/supportedAlgorithms") {
    return json({
      algorithms: [
        { alg: MUTUAL_SOFT_BINDING_CONTENT_ALG, lookup: "byContent" },
        { alg: MUTUAL_SOFT_BINDING_REFERENCE_ALG, lookup: "byReference" },
      ],
    });
  }
  if (request.method === "POST" && url.pathname === "/soft-binding/matches/byContent") return softBindingMatchesByContent(request, env);
  if (request.method === "POST" && url.pathname === "/soft-binding/matches/byReference") return softBindingMatchesByReference(request, env);
  if (request.method === "GET" && url.pathname.startsWith("/soft-binding/manifests/")) return softBindingManifest(url, env);
  return json({ error: "not_found" }, 404);
}

async function softBindingMatchesByContent(request: Request, env: RuntimeEnv): Promise<Response> {
  const url = new URL(request.url);
  const limit = parseResolverLimit(url);
  const bytes = new Uint8Array(await request.arrayBuffer());
  const sha256 = await sha256HexBytes(bytes);
  const rows = await env.DB.prepare(
    `select manifest_id
     from soft_binding_index
     where content_sha256 = ?
     order by updated_at desc, id desc
     limit ?`,
  )
    .bind(sha256, limit)
    .all();
  return json({ matches: softBindingMatches(url, rows.results ?? []) });
}

async function softBindingMatchesByReference(request: Request, env: RuntimeEnv): Promise<Response> {
  const url = new URL(request.url);
  const body = await readJsonObject(request);
  const referenceUrl = typeof body?.referenceUrl === "string" ? body.referenceUrl : "";
  const safe = validatePublicHttpUrl(referenceUrl);
  if (!safe.ok) return json({ error: safe.reason }, 400);
  const normalized = normalizeUrl(new URL(safe.url.toString()));
  const rows = await env.DB.prepare(
    `select manifest_id
     from soft_binding_index
     where normalized_url = ?
     order by updated_at desc, id desc
     limit ?`,
  )
    .bind(normalized, parseResolverLimit(url))
    .all();
  return json({ matches: softBindingMatches(url, rows.results ?? []) });
}

async function softBindingManifest(url: URL, env: RuntimeEnv): Promise<Response> {
  const manifestId = decodeURIComponent(url.pathname.slice("/soft-binding/manifests/".length));
  const row = await env.DB.prepare("select manifest_json from soft_binding_index where manifest_id = ?")
    .bind(manifestId)
    .first<{ manifest_json: string }>();
  if (!row) return json({ error: "not_found" }, 404);
  return new Response(row.manifest_json, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}

function softBindingMatches(url: URL, rows: unknown[]): Array<{ manifestId: string; endpoint: string; similarityScore: number }> {
  const endpoint = `${url.origin}/soft-binding`;
  return rows
    .map((row) => (row && typeof row === "object" && "manifest_id" in row ? String((row as { manifest_id: unknown }).manifest_id) : ""))
    .filter(Boolean)
    .map((manifestId) => ({ manifestId, endpoint, similarityScore: 100 }));
}

function parseResolverLimit(url: URL): number {
  const requested = Number(url.searchParams.get("maxResults") ?? "10");
  return Number.isFinite(requested) ? Math.max(1, Math.min(50, Math.trunc(requested))) : 10;
}

export function buildAssetQuery(query: AssetQuery): {
  sql: string;
  params: unknown[];
} {
  const where: string[] = [];
  const params: unknown[] = [];

  if (query.includeDiagnostics) {
    where.push("public_category in ('real', 'edited', 'excluded_ai_generated', 'diagnostic')");
  } else if (query.includeExcludedAi) {
    where.push("public_category in ('real', 'edited', 'excluded_ai_generated')");
  } else {
    where.push("public_category in ('real', 'edited')");
  }

  if (query.category) {
    where.push("public_category = ?");
    params.push(query.category);
  }
  if (query.q) {
    where.push("(url like ? or domain like ? or signer like ? or claim_generator like ? or platform_claim_app like ? or platform_claim_issued_by like ?)");
    const pattern = `%${query.q}%`;
    params.push(pattern, pattern, pattern, pattern, pattern, pattern);
  }
  if (query.domain) {
    where.push("domain = ?");
    params.push(query.domain.toLowerCase());
  }
  if (query.signer) {
    where.push("signer like ?");
    params.push(`%${query.signer}%`);
  }
  if (query.generator) {
    where.push("claim_generator like ?");
    params.push(`%${query.generator}%`);
  }
  if (query.classification) {
    where.push("classification = ?");
    params.push(query.classification);
  }
  if (query.cursor) {
    where.push("(latest_validated_at < ? or (latest_validated_at = ? and id < ?))");
    params.push(query.cursor.validatedAt, query.cursor.validatedAt, query.cursor.mediaAssetId);
  }

  params.push(query.limit);
  return {
    sql: `select id, url, domain, source_type, source_url, classification, public_category, validation_status,
                 digital_source_type,
                 trust_status, signer, claim_generator, content_type,
                 platform_claim_source, platform_claim_app, platform_claim_issued_by, platform_claim_issued_at,
                 platform_claim_ai_disclosure, platform_claim_category_hint,
                 soft_binding_status, soft_binding_resolver, soft_binding_lookup_method, soft_binding_manifest_id,
                 soft_binding_manifest_url, soft_binding_similarity, soft_binding_recovered_at,
                 latest_validated_at, created_at
          from media_assets
          where ${where.join(" and ")}
          order by latest_validated_at desc, id desc
          limit ?`,
    params,
  };
}

async function createCrawlRun(request: Request, env: RuntimeEnv, ctx: ExecutionContext): Promise<Response> {
  const body = await readJsonObject(request);
  if (!body) return json({ error: "invalid_json" }, 400);

  const sources = parseDiscoverySources(body);
  if (!sources.length) return json({ error: "sources_required" }, 400);

  for (const source of sources) {
    const safety = validatePublicHttpUrl(source.value);
    const isSearchQuery = source.type === "search_api" || source.type === "common_crawl";
    if (!isSearchQuery && !safety.ok) return json({ error: safety.reason, source: source.value }, 400);
  }

  const plan = planDiscoveryBatch(sources);
  const firstSource = plan.items[0];
  const run = await env.DB.prepare(
    `insert into crawl_runs (source_type, seed_url, status, requested_limit, release_ready, methodology_version)
     values (?, ?, 'queued', ?, ?, ?)
     returning id, source_type, seed_url, status, release_ready, created_at`,
  )
    .bind(firstSource?.sourceType ?? "manual_seed", firstSource?.value ?? null, Number(body.limit ?? 20), plan.releaseReady ? 1 : 0, env.METHODOLOGY_VERSION)
    .first<{ id: number }>();

  if (!run) return json({ error: "crawl_run_create_failed" }, 500);

  for (const item of plan.items) {
    await env.DB.prepare(
      `insert into discovery_sources (crawl_run_id, source_type, provider, source_url, query, ordinal)
       values (?, ?, ?, ?, ?, ?)
       returning id`,
    )
      .bind(
        run.id,
        item.sourceType,
        item.provider,
        item.value.startsWith("http") ? item.value : null,
        item.value.startsWith("http") ? null : item.value,
        item.ordinal,
      )
      .first();
  }

  ctx.waitUntil(Promise.all(plan.items.map((item) => env.DISCOVERY_QUEUE.send({ stage: "discovery", crawl_run_id: run.id, source: item }))));

  return json(
    {
      crawl_run_id: run.id,
      release_ready: plan.releaseReady,
      missing_broad_sources: plan.missingBroadSources,
      queued_sources: plan.items.length,
    },
    202,
  );
}

async function scanCompatibility(request: Request, env: RuntimeEnv, ctx: ExecutionContext): Promise<Response> {
  const body = await readJsonObject(request);
  const rawUrl = typeof body?.url === "string" ? body.url : "";
  const safe = validatePublicHttpUrl(rawUrl);
  if (!safe.ok) return json({ error: safe.reason }, 400);

  if (isLikelyMediaUrl(safe.url.toString())) {
    const asset = await upsertMediaAsset(env, {
      url: safe.url.toString(),
      sourceType: "direct_media",
      sourceUrl: safe.url.toString(),
      attribute: "url",
      ordinal: 0,
    });
    ctx.waitUntil(env.FETCH_QUEUE.send({ stage: "fetch", media_asset_id: asset.id, media_url: safe.url.toString() }));
    return json({ queued: true, media_asset_id: asset.id, url: safe.url.toString(), classification: "pending_validation" }, 202);
  }

  const runRequest = new Request(request.url.replace("/api/scan", "/api/crawl-runs"), {
    method: "POST",
    body: JSON.stringify({ sources: [{ type: "manual_seed", value: safe.url.toString() }] }),
  });
  return createCrawlRun(runRequest, env, ctx);
}

async function recent(env: RuntimeEnv): Promise<Response> {
  const rows = await env.DB.prepare(
    `select id, url, classification, public_category, validation_status, content_type, latest_validated_at, created_at
     from media_assets
     where public_category in ('real', 'edited')
     order by coalesce(latest_validated_at, created_at) desc, id desc
     limit 25`,
  ).all();
  return json({ assets: rows.results ?? [] });
}

async function listCrawlRuns(env: RuntimeEnv): Promise<Response> {
  const rows = await env.DB.prepare(
    `select id, source_type, seed_url, status, release_ready, pages_fetched, media_candidates,
            validations_completed, failures, created_at, updated_at
     from crawl_runs
     order by created_at desc
     limit 50`,
  ).all();
  return json({ crawl_runs: rows.results ?? [] });
}

async function validationJobs(request: Request, env: RuntimeEnv): Promise<Response> {
  const secret = env.VALIDATOR_PULL_SECRET || env.VALIDATOR_CALLBACK_SECRET;
  const supplied =
    request.headers.get("x-mutual-validator-pull-secret") ??
    bearerToken(request.headers.get("authorization")) ??
    "";
  if (!secret || !constantTimeEqual(secret, supplied)) return json({ error: "unauthorized" }, 401);

  const url = new URL(request.url);
  const requestedLimit = Number(url.searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(50, Math.trunc(requestedLimit))) : 20;
  const now = new Date();
  const nowIso = now.toISOString();
  const leaseExpiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
  const leaseOwner = `validator-pull:${crypto.randomUUID()}`;

  const candidates = await env.DB.prepare(buildValidationJobsQuery().sql)
    .bind(nowIso, limit)
    .all();
  const ids = (candidates.results ?? [])
    .map((row) => Number((row as { id?: unknown }).id))
    .filter((id) => Number.isSafeInteger(id));

  const claimed: number[] = [];
  for (const id of ids) {
    const result = await env.DB.prepare(
      `update validation_attempts
       set status = 'leased', lease_owner = ?, lease_expires_at = ?
       where id = ?
         and (status = 'queued' or (status = 'leased' and lease_expires_at < ?))`,
    )
      .bind(leaseOwner, leaseExpiresAt, id, nowIso)
      .run();
    if (result.meta?.changes) claimed.push(id);
  }

  if (!claimed.length) return json({ jobs: [], lease_owner: leaseOwner, lease_expires_at: leaseExpiresAt });

  const placeholders = claimed.map(() => "?").join(",");
  const rows = await env.DB.prepare(
    `select va.id as validation_attempt_id, va.media_asset_id, va.idempotency_key,
            ma.url as media_url, ma.content_type, ma.byte_length, ma.source_type, ma.source_url
     from validation_attempts va
     join media_assets ma on ma.id = va.media_asset_id
     where va.id in (${placeholders})
       and va.lease_owner = ?
     order by va.created_at asc, va.id asc`,
  )
    .bind(...claimed, leaseOwner)
    .all();
  return json({ jobs: rows.results ?? [], lease_owner: leaseOwner, lease_expires_at: leaseExpiresAt });
}

export function buildValidationJobsQuery(): { sql: string } {
  return {
    sql: `select va.id
     from validation_attempts va
     join media_assets ma on ma.id = va.media_asset_id
     where (va.status = 'queued' or (va.status = 'leased' and va.lease_expires_at < ?))
       and ma.status in ('fetched', 'candidate', 'fetch_failed')
     order by va.created_at asc, va.id asc
     limit ?`,
  };
}

export function shouldReplaceLatestValidation(
  current: { validationStatus?: string | null; publicCategory?: string | null; trustStatus?: string | null } | null,
  incoming: { status: string },
): boolean {
  const isTrustedPublic =
    current?.validationStatus === "valid" &&
    current.trustStatus === "trusted" &&
    (current.publicCategory === "real" || current.publicCategory === "edited" || current.publicCategory === "excluded_ai_generated");

  return !(isTrustedPublic && (incoming.status === "fetch_failed" || incoming.status === "no_manifest" || incoming.status === "unsupported_format"));
}

export function linkedInClaimToMediaCandidate(
  claim: LinkedInC2paClaim,
): { candidate: MediaCandidate; platform: PlatformClaimMetadata } | null {
  if (!claim.mediaUrl) return null;

  return {
    candidate: {
      url: claim.mediaUrl,
      sourceType: "linkedin_public_post",
      sourceUrl: claim.postUrl,
      attribute: "linkedin:c2pa_badge",
      ordinal: claim.ordinal,
    },
    platform: {
      platformClaimSource: claim.platformClaimSource,
      platformClaimApp: claim.app,
      platformClaimIssuedBy: claim.issuedBy,
      platformClaimIssuedAt: claim.issuedAt,
      platformClaimAiDisclosure: claim.aiDisclosure,
      platformClaimCategoryHint: claim.categoryHint,
      platformClaimJson: JSON.stringify(claim),
    },
  };
}

export function normalizeValidatorPayload(payload: ValidatorCallbackPayload): ReturnType<typeof normalizeValidation> {
  return normalizeValidation({
    manifestPresent: Boolean(payload.manifest_present),
    signatureTrusted: payload.status === "valid" && payload.trust_status !== "untrusted",
    validationStatus:
      payload.status === "valid"
        ? "valid"
        : payload.status === "unsupported_format"
          ? "unsupported_format"
          : payload.status === "no_manifest"
            ? "no_manifest"
            : payload.status === "fetch_failed"
              ? "fetch_failed"
              : "invalid",
    digitalSourceType: payload.digital_source_type,
    actions: payload.actions ?? [],
    ingredientsCount: payload.ingredients_count ?? 0,
    aiDisclosurePresent: Boolean(payload.ai_disclosure_present),
    softBindingRecovered: payload.soft_binding?.status === "recovered" && Boolean(payload.soft_binding.manifest_id),
  });
}

interface SoftBindingRecord {
  status: string | null;
  resolver: string | null;
  lookupMethod: string | null;
  manifestId: string | null;
  manifestUrl: string | null;
  similarity: number | null;
}

export function softBindingRecordFromPayload(payload: ValidatorCallbackPayload): SoftBindingRecord {
  const softBinding = payload.soft_binding;
  const similarity = Number(softBinding?.similarity_score);
  return {
    status: softBinding?.status ?? null,
    resolver: softBinding?.resolver_name ?? null,
    lookupMethod: softBinding?.lookup_method ?? null,
    manifestId: softBinding?.manifest_id ?? null,
    manifestUrl: softBinding?.manifest_url ?? null,
    similarity: Number.isFinite(similarity) ? similarity : null,
  };
}

async function validatorCallback(request: Request, env: RuntimeEnv): Promise<Response> {
  const body = await request.text();
  const keyId = request.headers.get("x-mutual-validator-key-id") ?? env.VALIDATOR_KEY_ID;
  const secret = env.VALIDATOR_CALLBACK_SECRET;
  const secrets = new Map<string, string>();
  if (secret) secrets.set(keyId, secret);

  const verified = await verifyValidatorCallback({
    body,
    nowSeconds: Math.floor(Date.now() / 1000),
    headers: request.headers,
    secrets,
    hasSeenNonce: async (seenKeyId, nonce) => {
      const row = await env.DB.prepare("select 1 as found from validator_callback_nonces where key_id = ? and nonce = ?")
        .bind(seenKeyId, nonce)
        .first();
      return Boolean(row);
    },
  });

  if (!verified.ok) {
    await recordSecurityEvent(env, "validator_callback_rejected", keyId, verified.reason, body);
    return json({ error: verified.reason }, 401);
  }

  await env.DB.prepare("insert into validator_callback_nonces (key_id, nonce) values (?, ?)").bind(verified.keyId, verified.nonce).run();

  let payload: ValidatorCallbackPayload;
  try {
    payload = JSON.parse(body) as ValidatorCallbackPayload;
  } catch {
    await recordSecurityEvent(env, "validator_callback_rejected", verified.keyId, "invalid_json", body);
    return json({ error: "invalid_json" }, 400);
  }

  const outstanding = await findOutstandingAttempt(env, payload);
  if (!outstanding) {
    await recordSecurityEvent(env, "validator_callback_rejected", verified.keyId, "attempt_mismatch", body);
    return json({ error: "attempt_mismatch" }, 401);
  }

  const normalized = normalizeValidatorPayload(payload);

  await storeValidationAttempt(env, payload, normalized);
  return json({ accepted: true, classification: normalized.classification, public_category: normalized.publicCategory });
}

async function findOutstandingAttempt(env: RuntimeEnv, payload: ValidatorCallbackPayload): Promise<{ id: number } | null> {
  if (payload.validation_attempt_id) {
    const row = await env.DB.prepare(
      "select id from validation_attempts where id = ? and media_asset_id = ? and (? is null or idempotency_key = ?)",
    )
      .bind(payload.validation_attempt_id, payload.media_asset_id, payload.idempotency_key ?? null, payload.idempotency_key ?? null)
      .first<{ id: number }>();
    return row ?? null;
  }

  if (payload.idempotency_key) {
    const row = await env.DB.prepare("select id from validation_attempts where media_asset_id = ? and idempotency_key = ?")
      .bind(payload.media_asset_id, payload.idempotency_key)
      .first<{ id: number }>();
    return row ?? null;
  }

  return null;
}

async function mcpQuery(request: Request, env: RuntimeEnv): Promise<Response> {
  const body = await readJsonObject(request);
  const q = typeof body?.query === "string" ? body.query : "";
  const url = new URL("https://internal/api/assets");
  if (q) url.searchParams.set("q", q);
  if (typeof body?.category === "string") url.searchParams.set("category", body.category);
  return listAssets(url, env);
}

async function mcpJsonRpc(request: Request, env: RuntimeEnv, ctx: ExecutionContext): Promise<Response> {
  const body = await readJsonObject(request);
  if (!body) return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
  const id = body.id ?? null;
  const method = typeof body.method === "string" ? body.method : "";
  const params = body.params && typeof body.params === "object" ? (body.params as Record<string, unknown>) : {};

  if (method === "initialize") {
    return json({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2025-06-18",
        serverInfo: { name: "mutual-c2pa-hub", version: env.METHODOLOGY_VERSION },
        capabilities: { tools: {} },
      },
    });
  }

  if (method === "tools/list") {
    return json({
      jsonrpc: "2.0",
      id,
      result: {
        tools: [
          {
            name: "search_c2pa_images",
            description: "Search public C2PA-validated real or edited images. Pure AI-generated results are excluded unless explicitly requested.",
            inputSchema: {
              type: "object",
              properties: {
                q: { type: "string" },
                category: { type: "string", enum: ["real", "edited"] },
                domain: { type: "string" },
                signer: { type: "string" },
                include_excluded_ai: { type: "boolean" },
                limit: { type: "number" },
              },
            },
          },
          {
            name: "queue_crawl_source",
            description: "Queue a discovery source for C2PA media ingestion.",
            inputSchema: {
              type: "object",
              required: ["type", "value"],
              properties: {
                type: { type: "string", enum: ["search_api", "sitemap", "rss", "known_repository", "common_crawl", "manual_seed"] },
                value: { type: "string" },
                provider: { type: "string" },
              },
            },
          },
          {
            name: "get_methodology",
            description: "Return the current public classification and exclusion methodology.",
            inputSchema: { type: "object", properties: {} },
          },
        ],
      },
    });
  }

  if (method === "tools/call") {
    const name = typeof params.name === "string" ? params.name : "";
    const args = params.arguments && typeof params.arguments === "object" ? (params.arguments as Record<string, unknown>) : {};
    if (name === "search_c2pa_images") {
      const url = new URL("https://internal/api/assets");
      if (typeof args.category === "string") url.searchParams.set("category", args.category);
      if (typeof args.domain === "string") url.searchParams.set("domain", args.domain);
      if (typeof args.signer === "string") url.searchParams.set("signer", args.signer);
      if (typeof args.q === "string") url.searchParams.set("q", args.q);
      if (typeof args.limit === "number") url.searchParams.set("limit", String(args.limit));
      if (args.include_excluded_ai === true) url.searchParams.set("include_excluded_ai", "true");
      const response = await listAssets(url, env);
      return json({ jsonrpc: "2.0", id, result: { content: [{ type: "json", json: await response.json() }] } });
    }
    if (name === "queue_crawl_source") {
      const source = {
        type: typeof args.type === "string" ? args.type : "manual_seed",
        value: typeof args.value === "string" ? args.value : "",
        provider: typeof args.provider === "string" ? args.provider : undefined,
      };
      const response = await createCrawlRun(
        new Request("https://internal/api/crawl-runs", { method: "POST", body: JSON.stringify({ sources: [source] }) }),
        env,
        ctx,
      );
      return json({ jsonrpc: "2.0", id, result: { content: [{ type: "json", json: await response.json() }] } }, response.status);
    }
    if (name === "get_methodology") {
      return json({ jsonrpc: "2.0", id, result: { content: [{ type: "json", json: methodology(env) }] } });
    }
  }

  return json({ jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } }, 404);
}

async function handleQueueMessage(message: QueueMessage, env: RuntimeEnv): Promise<void> {
  if (message.source && message.crawl_run_id) {
    await processDiscoverySource(env, message.crawl_run_id, message.source);
  }
  if (message.stage === "fetch" && message.media_asset_id && message.media_url) {
    await processFetch(env, message.media_asset_id, message.media_url, message.crawl_run_id);
  }
  if (message.stage === "validate" && message.media_asset_id && message.media_url) {
    await processValidation(env, message.media_asset_id, message.media_url, message.crawl_run_id);
  }
}

async function processDiscoverySource(env: RuntimeEnv, crawlRunId: number, source: NonNullable<QueueMessage["source"]>): Promise<void> {
  if (source.sourceType === "search_api") {
    await discoverFromSearch(env, crawlRunId, source.value);
    return;
  }
  if (source.sourceType === "common_crawl") {
    await discoverFromCommonCrawl(env, crawlRunId, source.value);
    return;
  }
  if (source.sourceType === "known_repository") {
    await discoverFromKnownRepository(env, crawlRunId, source.value);
    return;
  }
  const safe = validatePublicHttpUrl(source.value);
  if (!safe.ok) return;

  if (isLikelyMediaUrl(safe.url.toString())) {
    const candidate = candidatesFromUrls([safe.url.toString()], safe.url.toString(), "direct_media")[0];
    const asset = await upsertMediaAsset(env, candidate);
    await env.FETCH_QUEUE.send({ stage: "fetch", crawl_run_id: crawlRunId, media_asset_id: asset.id, media_url: asset.url });
    return;
  }

  const robots = await checkRobots(env, crawlRunId, safe.url);
  if (!robots.allowed) return;

  const response = await fetch(safe.url.toString(), {
    headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.5" },
    redirect: "follow",
  });
  const body = await response.text();
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.startsWith("image/")) {
    const asset = await upsertMediaAsset(env, {
      url: safe.url.toString(),
      sourceType: "direct_media",
      sourceUrl: safe.url.toString(),
      attribute: "content-type",
      ordinal: 0,
    });
    await env.FETCH_QUEUE.send({ stage: "fetch", crawl_run_id: crawlRunId, media_asset_id: asset.id, media_url: asset.url });
    await env.DB.prepare("update crawl_runs set media_candidates = media_candidates + 1, updated_at = ? where id = ?")
      .bind(new Date().toISOString(), crawlRunId)
      .run();
    return;
  }
  const linkedPages = source.sourceType === "sitemap" || source.sourceType === "rss" || /xml|rss|atom/i.test(contentType) ? extractXmlLinks(body, safe.url.toString()) : [];
  for (const linkedPage of linkedPages.slice(0, 50)) {
    await env.DISCOVERY_QUEUE.send({
      stage: "discovery",
      crawl_run_id: crawlRunId,
      source: { sourceType: "html", value: linkedPage, provider: source.provider, ordinal: source.ordinal },
    });
  }

  let queued = 0;
  const platformMediaUrls = new Set<string>();
  if (isLinkedInPageUrl(safe.url)) {
    for (const claim of extractLinkedInC2paClaims(body, safe.url.toString()).slice(0, 50)) {
      const linkedInCandidate = linkedInClaimToMediaCandidate(claim);
      if (!linkedInCandidate) continue;
      const asset = await upsertMediaAsset(env, linkedInCandidate.candidate, linkedInCandidate.platform);
      platformMediaUrls.add(asset.url);
      queued += 1;
      await env.FETCH_QUEUE.send({ stage: "fetch", crawl_run_id: crawlRunId, media_asset_id: asset.id, media_url: asset.url });
    }
  }

  const candidates = extractMediaCandidates(body, safe.url.toString(), source.sourceType === "rss" || source.sourceType === "sitemap" ? source.sourceType : "html");
  for (const candidate of candidates.slice(0, 50)) {
    if (platformMediaUrls.has(candidate.url)) continue;
    const asset = await upsertMediaAsset(env, candidate);
    queued += 1;
    await env.FETCH_QUEUE.send({ stage: "fetch", crawl_run_id: crawlRunId, media_asset_id: asset.id, media_url: asset.url });
  }
  await env.DB.prepare("update crawl_runs set pages_fetched = pages_fetched + 1, media_candidates = media_candidates + ?, updated_at = ? where id = ?")
    .bind(queued, new Date().toISOString(), crawlRunId)
    .run();
}

async function discoverFromSearch(env: RuntimeEnv, crawlRunId: number, query: string): Promise<void> {
  if (!env.BRAVE_SEARCH_API_KEY) return;
  const searchUrl = new URL("https://api.search.brave.com/res/v1/images/search");
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("count", "50");
  const response = await fetch(searchUrl, {
    headers: {
      accept: "application/json",
      "x-subscription-token": env.BRAVE_SEARCH_API_KEY,
      "user-agent": USER_AGENT,
    },
  });
  if (!response.ok) return;
  const body = (await response.json()) as { results?: Array<{ properties?: { url?: string }; url?: string; thumbnail?: { src?: string } }> };
  const urls = (body.results ?? []).flatMap((result) => [result.properties?.url, result.url, result.thumbnail?.src]).filter((value): value is string => Boolean(value));
  for (const candidate of candidatesFromUrls(urls, `brave:${query}`, "search_api")) {
    const asset = await upsertMediaAsset(env, candidate);
    await env.FETCH_QUEUE.send({ stage: "fetch", crawl_run_id: crawlRunId, media_asset_id: asset.id, media_url: asset.url });
  }
  await env.DB.prepare("update crawl_runs set media_candidates = media_candidates + ?, updated_at = ? where id = ?")
    .bind(urls.length, new Date().toISOString(), crawlRunId)
    .run();
}

async function discoverFromKnownRepository(env: RuntimeEnv, crawlRunId: number, repositoryUrl: string): Promise<void> {
  const urls = repositoryUrl.includes("gitlab.com/guardianproject/proofmode/proofmode-c2pa-sample-media")
    ? await listProofmodeSampleMedia()
    : repositoryUrl.includes("github.com/contentauth/example-assets")
      ? await listContentAuthExampleAssets()
    : repositoryUrl.includes("github.com/contentauth/c2pa-conformance-tool-cli")
      ? await listContentAuthConformanceToolCliAssets()
    : repositoryUrl.includes("github.com/c2pa-org/public-testfiles")
      ? await listC2paPublicTestImages()
      : await listRepositoryMediaUrls(repositoryUrl);

  for (const candidate of candidatesFromUrls(urls, repositoryUrl, "known_repository").slice(0, KNOWN_REPOSITORY_CANDIDATE_LIMIT)) {
    const asset = await upsertMediaAsset(env, candidate);
    await env.FETCH_QUEUE.send({ stage: "fetch", crawl_run_id: crawlRunId, media_asset_id: asset.id, media_url: asset.url });
  }

  await env.DB.prepare("update crawl_runs set media_candidates = media_candidates + ?, updated_at = ? where id = ?")
    .bind(urls.length, new Date().toISOString(), crawlRunId)
    .run();
}

async function discoverFromCommonCrawl(env: RuntimeEnv, crawlRunId: number, query: string): Promise<void> {
  const collections = await fetch("https://index.commoncrawl.org/collinfo.json", {
    headers: { "user-agent": USER_AGENT, accept: "application/json" },
  });
  if (!collections.ok) return;
  const collectionList = (await collections.json()) as Array<{ id: string; "cdx-api": string }>;
  const latest = collectionList[0];
  if (!latest?.["cdx-api"]) return;

  const indexUrl = new URL(latest["cdx-api"]);
  indexUrl.searchParams.set("url", commonCrawlUrlPattern(query));
  indexUrl.searchParams.set("output", "json");
  indexUrl.searchParams.set("filter", "status:200");
  indexUrl.searchParams.set("fl", "url,mime,status");
  indexUrl.searchParams.set("limit", "250");
  const response = await fetch(indexUrl, { headers: { "user-agent": USER_AGENT, accept: "application/json" } });
  if (!response.ok) return;
  const lines = (await response.text()).split(/\r?\n/).filter(Boolean);
  let queued = 0;
  for (const line of lines) {
    try {
      const record = JSON.parse(line) as { url?: string; mime?: string };
      if (!record.url) continue;
      if (isLikelyMediaUrl(record.url) || /image|video|pdf/i.test(record.mime ?? "")) {
        for (const candidate of candidatesFromUrls([record.url], `commoncrawl:${latest.id}:${query}`, "common_crawl")) {
          const asset = await upsertMediaAsset(env, candidate);
          await env.FETCH_QUEUE.send({ stage: "fetch", crawl_run_id: crawlRunId, media_asset_id: asset.id, media_url: asset.url });
          queued += 1;
        }
      } else {
        await env.DISCOVERY_QUEUE.send({
          stage: "discovery",
          crawl_run_id: crawlRunId,
          source: { sourceType: "html", value: record.url, provider: "common_crawl", ordinal: queued },
        });
        queued += 1;
      }
    } catch {
      // Ignore malformed CDX lines.
    }
  }
  await env.DB.prepare("update crawl_runs set media_candidates = media_candidates + ?, updated_at = ? where id = ?")
    .bind(queued, new Date().toISOString(), crawlRunId)
    .run();
}

async function checkRobots(env: RuntimeEnv, crawlRunId: number, target: URL): Promise<{ allowed: boolean }> {
  try {
    const response = await fetch(robotsUrlFor(target), {
      headers: { "user-agent": USER_AGENT, accept: "text/plain,*/*;q=0.5" },
      redirect: "follow",
    });
    if (!response.ok) {
      await recordSourcePage(env, crawlRunId, target, "robots_unavailable", response.status, "not_checked", null);
      return { allowed: true };
    }
    const decision = evaluateRobotsTxt(await response.text(), `${target.pathname}${target.search}`, USER_AGENT);
    await recordSourcePage(env, crawlRunId, target, decision.allowed ? "queued" : "robots_disallowed", response.status, decision.reason, decision.matchedRule ?? null);
    return { allowed: decision.allowed };
  } catch (error) {
    await recordSourcePage(env, crawlRunId, target, "robots_error", null, "not_checked", error instanceof Error ? error.message : String(error));
    return { allowed: true };
  }
}

async function recordSourcePage(
  env: RuntimeEnv,
  crawlRunId: number,
  url: URL,
  status: string,
  httpStatus: number | null,
  robotsStatus: string,
  errorDetail: string | null,
): Promise<void> {
  await env.DB.prepare(
    `insert into source_pages (crawl_run_id, url, normalized_url, domain, status, http_status, robots_status, error_detail)
     values (?, ?, ?, ?, ?, ?, ?, ?)
     on conflict(normalized_url) do update set
       status = excluded.status,
       http_status = excluded.http_status,
       robots_status = excluded.robots_status,
       error_detail = excluded.error_detail`,
  )
    .bind(crawlRunId, url.toString(), normalizeUrl(new URL(url.toString())), url.hostname.toLowerCase(), status, httpStatus, robotsStatus, errorDetail)
    .run();
}

function extractXmlLinks(xml: string, baseUrl: string): string[] {
  const links: string[] = [];
  const seen = new Set<string>();
  const patterns = [
    /<loc[^>]*>\s*([^<\s]+)\s*<\/loc>/gi,
    /<link[^>]*>\s*([^<\s]+)\s*<\/link>/gi,
    /\burl=["']([^"']+)["']/gi,
    /\bhref=["']([^"']+)["']/gi,
  ];
  for (const pattern of patterns) {
    for (const match of xml.matchAll(pattern)) {
      try {
        const url = new URL(decodeXml(match[1]), baseUrl);
        if (url.protocol !== "http:" && url.protocol !== "https:") continue;
        const normalized = url.toString();
        if (seen.has(normalized)) continue;
        seen.add(normalized);
        links.push(normalized);
      } catch {
        // Ignore malformed feed/sitemap entries.
      }
    }
  }
  return links;
}

function decodeXml(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function commonCrawlUrlPattern(query: string): string {
  const normalized = query.toLowerCase();
  if (normalized.includes("content-credentials")) return "*content-credentials*";
  if (normalized.includes("c2pa")) return "*c2pa*";
  if (normalized.includes("pixel")) return "*pixel*";
  return "*contentauthenticity*";
}

async function processFetch(env: RuntimeEnv, mediaAssetId: number, mediaUrl: string, crawlRunId?: number): Promise<void> {
  const safe = validatePublicHttpUrl(mediaUrl);
  if (!safe.ok) {
    await env.DB.prepare("update media_assets set status = 'fetch_rejected', validation_status = 'fetch_failed', classification = 'fetch_failed', public_category = 'diagnostic' where id = ?")
      .bind(mediaAssetId)
      .run();
    return;
  }

  const started = Date.now();
  const response = await fetch(safe.url.toString(), {
    headers: mediaFetchHeaders(safe.url, "image/*,video/*,application/pdf,*/*;q=0.5", `bytes=0-${PREFILTER_BYTES - 1}`),
    redirect: "follow",
  });
  const declaredContentType = response.headers.get("content-type") ?? "application/octet-stream";
  const bytes = new Uint8Array(await response.arrayBuffer());
  const contentType = inferMediaContentType(bytes, declaredContentType);
  const evidence = classifyC2paEvidence(bytes);
  const idempotencyKey = `fetch:${mediaAssetId}:${await sha256Hex(safe.url.toString())}:${bytes.byteLength}`;
  const completeBody = response.ok && isCompleteFetchedBody(response, bytes.byteLength);
  const sha256 = completeBody ? await sha256HexBytes(bytes) : null;
  const byteLength = mediaByteLength(response, bytes.byteLength);
  const shouldCacheImage = completeBody && contentType.startsWith("image/");
  const objectKey = shouldCacheImage ? mediaAssetObjectKey(mediaAssetId) : null;
  const nowIso = new Date().toISOString();
  if (objectKey) {
    await env.ASSETS.put(objectKey, bytes, { httpMetadata: { contentType } });
  }
  await env.DB.prepare(
    `insert or ignore into fetch_attempts
     (media_asset_id, idempotency_key, url, status, http_status, content_type, byte_length, sampled_byte_length, prefilter_markers, elapsed_ms)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      mediaAssetId,
      idempotencyKey,
      safe.url.toString(),
      response.ok ? "fetched" : "fetch_failed",
      response.status,
      contentType,
      byteLength,
      bytes.byteLength,
      JSON.stringify(evidence.markers),
      Date.now() - started,
    )
    .run();

  await env.DB.prepare(
    `update media_assets
     set status = ?, content_type = ?, byte_length = ?, sampled_byte_length = ?, sha256 = ?,
         cached_object_key = coalesce(?, cached_object_key),
         cached_content_type = coalesce(?, cached_content_type),
         cached_at = coalesce(?, cached_at),
         validation_status = 'queued', updated_at = ?
     where id = ?`,
  )
    .bind(response.ok ? "fetched" : "fetch_failed", contentType, byteLength, bytes.byteLength, sha256, objectKey, objectKey ? contentType : null, objectKey ? nowIso : null, nowIso, mediaAssetId)
    .run();

  await env.VALIDATE_QUEUE.send({ stage: "validate", crawl_run_id: crawlRunId, media_asset_id: mediaAssetId, media_url: safe.url.toString() });
}

async function processValidation(env: RuntimeEnv, mediaAssetId: number, mediaUrl: string, crawlRunId?: number): Promise<void> {
  const validatorUrl = env.VALIDATOR_SERVICE_URL;
  const idempotencyKey = `validation:${mediaAssetId}:${await sha256Hex(mediaUrl)}:${env.METHODOLOGY_VERSION}`;
  let attempt = await env.DB.prepare(
    `insert or ignore into validation_attempts
     (media_asset_id, idempotency_key, validator_name, validator_version, status, classification, public_category)
     values (?, ?, 'c2patool', 'external', 'queued', 'stripped_or_unknown', 'diagnostic')
     returning id`,
  )
    .bind(mediaAssetId, idempotencyKey)
    .first<{ id: number }>();

  const existing =
    attempt ??
    (await env.DB.prepare("select id from validation_attempts where idempotency_key = ?")
      .bind(idempotencyKey)
      .first<{ id: number }>());
  if (!existing) throw new Error("validation_attempt_create_failed");

  if (!validatorUrl) {
    await queueExternalValidation(env, mediaAssetId, existing.id);
    return;
  }

  const response = await fetch(new URL("/validate", validatorUrl).toString(), {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": USER_AGENT },
    body: JSON.stringify({
      validation_attempt_id: existing.id,
      media_asset_id: mediaAssetId,
      media_url: mediaUrl,
      callback_url: `${env.PUBLIC_BASE_URL}/api/validator-callback`,
      callback_auth: { scheme: "hmac-sha256", key_id: env.VALIDATOR_KEY_ID },
      idempotency_key: idempotencyKey,
    }),
  });

  if (!response.ok) {
    await env.DB.prepare("update media_assets set validation_status = 'validator_dispatch_failed', updated_at = ? where id = ?")
      .bind(new Date().toISOString(), mediaAssetId)
      .run();
    throw new Error(`validator_dispatch_failed:${response.status}`);
  }
}

async function queueExternalValidation(env: RuntimeEnv, mediaAssetId: number, validationAttemptId: number): Promise<void> {
  await env.DB.prepare(
    `update validation_attempts
     set validator_name = 'github-actions-c2patool',
         validator_version = 'pending',
         status = 'queued',
         classification = 'stripped_or_unknown',
         public_category = 'diagnostic'
     where id = ?`,
  )
    .bind(validationAttemptId)
    .run();
  await env.DB.prepare("update media_assets set validation_status = 'queued_external_validator', updated_at = ? where id = ?")
    .bind(new Date().toISOString(), mediaAssetId)
    .run();
}

async function scheduleBroadDiscovery(env: RuntimeEnv, ctx: ExecutionContext): Promise<void> {
  const sources: DiscoveryInput[] = [
    { type: "search_api", value: "Content Credentials image", provider: "brave" },
    { type: "search_api", value: "Google Pixel Content Credentials photo", provider: "brave" },
    { type: "search_api", value: "C2PA signed photo sample", provider: "brave" },
    { type: "search_api", value: "content credentials verified photograph", provider: "brave" },
    { type: "search_api", value: "Leica M11-P content credentials photo", provider: "brave" },
    { type: "search_api", value: "Truepic verified image", provider: "brave" },
    { type: "search_api", value: "Proofmode verified photo", provider: "brave" },
    { type: "search_api", value: "Samsung Galaxy content credentials photo", provider: "brave" },
    { type: "known_repository", value: "https://gitlab.com/guardianproject/proofmode/proofmode-c2pa-sample-media" },
    { type: "known_repository", value: "https://gitlab.com/guardianproject/proofmode/proofmode-c2pa-conformance" },
    { type: "known_repository", value: "https://github.com/contentauth/example-assets" },
    { type: "known_repository", value: "https://github.com/contentauth/c2pa-conformance-tool-cli" },
    { type: "known_repository", value: "https://github.com/c2pa-org/public-testfiles" },
    { type: "manual_seed", value: "https://github.com/contentauth/c2pa-rs/issues/1555", provider: "github_issue_pixel10" },
    { type: "common_crawl", value: "url-index:content-credentials" },
    { type: "common_crawl", value: "url-index:c2pa" },
    { type: "common_crawl", value: "url-index:contentauthenticity" },
    { type: "manual_seed", value: "https://proofmode.org/baseline/" },
    { type: "manual_seed", value: "https://contentauth.github.io/example-assets/" },
    { type: "manual_seed", value: "https://www.linkedin.com/feed/update/urn:li:activity:7457195260054540288/", provider: "linkedin_public_post" },
    { type: "sitemap", value: "https://contentauthenticity.org/sitemap.xml" },
    { type: "rss", value: "https://contentauthenticity.org/feed.xml" },
  ];
  const request = new Request("https://c2pa.mutual.solutions/api/crawl-runs", {
    method: "POST",
    body: JSON.stringify({ sources }),
  });
  await createCrawlRun(request, env, ctx);
}

async function upsertMediaAsset(
  env: RuntimeEnv,
  candidate: { url: string; sourceType: string; sourceUrl: string; attribute: string; ordinal: number },
  platform?: PlatformClaimMetadata,
): Promise<{ id: number; url: string }> {
  const url = new URL(candidate.url);
  const normalized = normalizeUrl(url);
  const inserted = await env.DB.prepare(
    `insert into media_assets
     (url, normalized_url, domain, source_type, source_url, source_attribute, source_ordinal,
      platform_claim_source, platform_claim_app, platform_claim_issued_by, platform_claim_issued_at,
      platform_claim_ai_disclosure, platform_claim_category_hint, platform_claim_json)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     on conflict(normalized_url) do update set
       source_type = case when excluded.platform_claim_source is not null then excluded.source_type else media_assets.source_type end,
       source_url = case when excluded.platform_claim_source is not null then excluded.source_url else media_assets.source_url end,
       source_attribute = case when excluded.platform_claim_source is not null then excluded.source_attribute else media_assets.source_attribute end,
       source_ordinal = case when excluded.platform_claim_source is not null then excluded.source_ordinal else media_assets.source_ordinal end,
       platform_claim_source = coalesce(excluded.platform_claim_source, media_assets.platform_claim_source),
       platform_claim_app = coalesce(excluded.platform_claim_app, media_assets.platform_claim_app),
       platform_claim_issued_by = coalesce(excluded.platform_claim_issued_by, media_assets.platform_claim_issued_by),
       platform_claim_issued_at = coalesce(excluded.platform_claim_issued_at, media_assets.platform_claim_issued_at),
       platform_claim_ai_disclosure = coalesce(excluded.platform_claim_ai_disclosure, media_assets.platform_claim_ai_disclosure),
       platform_claim_category_hint = coalesce(excluded.platform_claim_category_hint, media_assets.platform_claim_category_hint),
       platform_claim_json = coalesce(excluded.platform_claim_json, media_assets.platform_claim_json),
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     returning id, url`,
  )
    .bind(
      candidate.url,
      normalized,
      url.hostname.toLowerCase(),
      candidate.sourceType,
      candidate.sourceUrl,
      candidate.attribute,
      candidate.ordinal,
      platform?.platformClaimSource ?? null,
      platform?.platformClaimApp ?? null,
      platform?.platformClaimIssuedBy ?? null,
      platform?.platformClaimIssuedAt ?? null,
      platform?.platformClaimAiDisclosure ?? null,
      platform?.platformClaimCategoryHint ?? null,
      platform?.platformClaimJson ?? null,
    )
    .first<{ id: number; url: string }>();
  if (inserted) return inserted;

  const row = await env.DB.prepare("select id, url from media_assets where normalized_url = ?").bind(normalized).first<{ id: number; url: string }>();
  if (!row) throw new Error("media_asset_upsert_failed");
  return row;
}

interface ValidatorCallbackPayload {
  validation_attempt_id?: number;
  media_asset_id: number;
  idempotency_key?: string;
  validator_name?: string;
  validator_version?: string;
  status: string;
  trust_status?: string;
  classification?: string;
  manifest_present?: boolean;
  signer?: string | null;
  claim_generator?: string | null;
  digital_source_type?: string | null;
  ai_disclosure_present?: boolean;
  actions?: string[];
  ingredients_count?: number;
  raw_validator_json?: unknown;
  error_code?: string | null;
  error_detail?: string | null;
  soft_binding?: {
    status?: string;
    resolver_name?: string | null;
    lookup_method?: string | null;
    manifest_id?: string | null;
    manifest_url?: string | null;
    similarity_score?: number | null;
  };
  trust_list?: {
    version?: string;
    ca_source_uri?: string;
    tsa_source_uri?: string;
    retrieved_at?: string;
    ca_sha256?: string;
    tsa_sha256?: string;
    signature_status?: string;
  };
}

async function storeValidationAttempt(
  env: RuntimeEnv,
  payload: ValidatorCallbackPayload,
  normalized: ReturnType<typeof normalizeValidation>,
): Promise<void> {
  const softBinding = softBindingRecordFromPayload(payload);
  const idempotencyKey =
    payload.idempotency_key ??
    `validation:${payload.media_asset_id}:${payload.validator_name ?? "validator"}:${payload.validator_version ?? "unknown"}:${Date.now()}`;
  let attempt = await env.DB.prepare(
    `insert or ignore into validation_attempts
     (media_asset_id, idempotency_key, validator_name, validator_version, trust_list_version,
      trust_list_ca_source_uri, trust_list_tsa_source_uri, trust_list_retrieved_at, trust_list_ca_sha256,
      trust_list_tsa_sha256, trust_list_signature_status, status, classification, public_category,
      signer, claim_generator, digital_source_type, ai_disclosure_present, manifest_present,
      soft_binding_status, soft_binding_resolver, soft_binding_lookup_method, soft_binding_manifest_id,
      soft_binding_manifest_url, soft_binding_similarity,
      ingredients_count, actions_json, raw_validator_json, error_code, error_detail)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     returning id, created_at`,
  )
    .bind(
      payload.media_asset_id,
      idempotencyKey,
      payload.validator_name ?? "external-validator",
      payload.validator_version ?? "unknown",
      payload.trust_list?.version ?? null,
      payload.trust_list?.ca_source_uri ?? null,
      payload.trust_list?.tsa_source_uri ?? null,
      payload.trust_list?.retrieved_at ?? null,
      payload.trust_list?.ca_sha256 ?? null,
      payload.trust_list?.tsa_sha256 ?? null,
      payload.trust_list?.signature_status ?? null,
      payload.status,
      normalized.classification,
      normalized.publicCategory,
      payload.signer ?? null,
      payload.claim_generator ?? null,
      payload.digital_source_type ?? null,
      payload.ai_disclosure_present ? 1 : 0,
      payload.manifest_present ? 1 : 0,
      softBinding.status,
      softBinding.resolver,
      softBinding.lookupMethod,
      softBinding.manifestId,
      softBinding.manifestUrl,
      softBinding.similarity,
      payload.ingredients_count ?? 0,
      JSON.stringify(payload.actions ?? []),
      JSON.stringify(payload.raw_validator_json ?? {}),
      payload.error_code ?? null,
      payload.error_detail ?? null,
    )
    .first<{ id: number; created_at: string }>();

  if (!attempt) {
    attempt = await env.DB.prepare("select id, created_at from validation_attempts where idempotency_key = ?")
      .bind(idempotencyKey)
      .first<{ id: number; created_at: string }>();
  }

  if (!attempt) throw new Error("validation_attempt_store_failed");

  const current = await env.DB.prepare("select id, url, normalized_url, domain, source_url, content_type, byte_length, sha256, validation_status, public_category, trust_status from media_assets where id = ?")
    .bind(payload.media_asset_id)
    .first<{
      id: number;
      url: string;
      normalized_url: string;
      domain: string | null;
      source_url: string | null;
      content_type: string | null;
      byte_length: number | null;
      sha256: string | null;
      validation_status: string | null;
      public_category: string | null;
      trust_status: string | null;
    }>();
  const replaceLatest = shouldReplaceLatestValidation(
    current
      ? {
          validationStatus: current.validation_status,
          publicCategory: current.public_category,
          trustStatus: current.trust_status,
        }
      : null,
    { status: payload.status },
  );
  const contextual = current ? applySourceContextPolicy(normalized, current) : normalized;

  await env.DB.prepare(
    `update validation_attempts
     set validator_name = ?, validator_version = ?, trust_list_version = ?, trust_list_ca_source_uri = ?,
         trust_list_tsa_source_uri = ?, trust_list_retrieved_at = ?, trust_list_ca_sha256 = ?,
         trust_list_tsa_sha256 = ?, trust_list_signature_status = ?, status = ?, classification = ?,
         public_category = ?, signer = ?, claim_generator = ?, digital_source_type = ?,
         ai_disclosure_present = ?, manifest_present = ?, ingredients_count = ?, actions_json = ?,
         soft_binding_status = ?, soft_binding_resolver = ?, soft_binding_lookup_method = ?,
         soft_binding_manifest_id = ?, soft_binding_manifest_url = ?, soft_binding_similarity = ?,
         raw_validator_json = ?, error_code = ?, error_detail = ?
     where id = ?`,
  )
    .bind(
      payload.validator_name ?? "external-validator",
      payload.validator_version ?? "unknown",
      payload.trust_list?.version ?? null,
      payload.trust_list?.ca_source_uri ?? null,
      payload.trust_list?.tsa_source_uri ?? null,
      payload.trust_list?.retrieved_at ?? null,
      payload.trust_list?.ca_sha256 ?? null,
      payload.trust_list?.tsa_sha256 ?? null,
      payload.trust_list?.signature_status ?? null,
      payload.status,
      contextual.classification,
      contextual.publicCategory,
      payload.signer ?? null,
      payload.claim_generator ?? null,
      payload.digital_source_type ?? null,
      payload.ai_disclosure_present ? 1 : 0,
      payload.manifest_present ? 1 : 0,
      payload.ingredients_count ?? 0,
      JSON.stringify(payload.actions ?? []),
      softBinding.status,
      softBinding.resolver,
      softBinding.lookupMethod,
      softBinding.manifestId,
      softBinding.manifestUrl,
      softBinding.similarity,
      JSON.stringify(payload.raw_validator_json ?? {}),
      payload.error_code ?? null,
      payload.error_detail ?? null,
      attempt.id,
    )
    .run();

  if (payload.status === "valid" && payload.manifest_present && current) {
    await upsertSoftBindingIndex(env, payload, contextual, attempt, current);
  }

  if (!replaceLatest) return;

  await env.DB.prepare(
    `insert into validation_summaries
     (media_asset_id, validation_attempt_id, status, classification, public_category, signer, claim_generator, validated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?)
     on conflict(media_asset_id) do update set
       validation_attempt_id = excluded.validation_attempt_id,
       status = excluded.status,
       classification = excluded.classification,
       public_category = excluded.public_category,
       signer = excluded.signer,
       claim_generator = excluded.claim_generator,
       validated_at = excluded.validated_at,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
  )
    .bind(
      payload.media_asset_id,
      attempt.id,
      payload.status,
      contextual.classification,
      contextual.publicCategory,
      payload.signer ?? null,
      payload.claim_generator ?? null,
      attempt.created_at,
    )
    .run();

  await env.DB.prepare(
    `update media_assets
     set classification = ?, public_category = ?, validation_status = ?, signer = ?, claim_generator = ?,
         digital_source_type = ?, ai_disclosure_present = ?, manifest_present = ?, trust_status = ?,
         soft_binding_status = ?, soft_binding_resolver = ?, soft_binding_lookup_method = ?,
         soft_binding_manifest_id = ?, soft_binding_manifest_url = ?, soft_binding_similarity = ?,
         soft_binding_recovered_at = ?, latest_validated_at = ?, updated_at = ?
     where id = ?`,
  )
    .bind(
      contextual.classification,
      contextual.publicCategory,
      payload.status,
      payload.signer ?? null,
      payload.claim_generator ?? null,
      payload.digital_source_type ?? null,
      payload.ai_disclosure_present ? 1 : 0,
      payload.manifest_present ? 1 : 0,
      payload.trust_status ?? null,
      softBinding.status,
      softBinding.resolver,
      softBinding.lookupMethod,
      softBinding.manifestId,
      softBinding.manifestUrl,
      softBinding.similarity,
      softBinding.status === "recovered" ? attempt.created_at : null,
      attempt.created_at,
      new Date().toISOString(),
      payload.media_asset_id,
    )
    .run();
}

async function upsertSoftBindingIndex(
  env: RuntimeEnv,
  payload: ValidatorCallbackPayload,
  normalized: ReturnType<typeof normalizeValidation>,
  attempt: { id: number; created_at: string },
  asset: { id: number; url: string; normalized_url: string; content_type: string | null; byte_length: number | null; sha256: string | null },
): Promise<void> {
  const manifestId = `urn:mutual:c2pa:asset:${payload.media_asset_id}:attempt:${attempt.id}`;
  const manifestJson = JSON.stringify({
    manifest_id: manifestId,
    media_asset_id: payload.media_asset_id,
    validation_attempt_id: attempt.id,
    source_url: asset.url,
    status: payload.status,
    trust_status: payload.trust_status ?? null,
    classification: normalized.classification,
    public_category: normalized.publicCategory,
    signer: payload.signer ?? null,
    claim_generator: payload.claim_generator ?? null,
    digital_source_type: payload.digital_source_type ?? null,
    ai_disclosure_present: Boolean(payload.ai_disclosure_present),
    actions: payload.actions ?? [],
    raw_validator_json: payload.raw_validator_json ?? {},
    created_at: attempt.created_at,
  });

  await env.DB.prepare(
    `insert into soft_binding_index
     (media_asset_id, validation_attempt_id, manifest_id, alg, content_sha256, byte_length, content_type, reference_url, normalized_url, manifest_json)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     on conflict(manifest_id) do update set
       alg = excluded.alg,
       content_sha256 = excluded.content_sha256,
       byte_length = excluded.byte_length,
       content_type = excluded.content_type,
       reference_url = excluded.reference_url,
       normalized_url = excluded.normalized_url,
       manifest_json = excluded.manifest_json,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
  )
    .bind(
      payload.media_asset_id,
      attempt.id,
      manifestId,
      MUTUAL_SOFT_BINDING_CONTENT_ALG,
      contentSha256ForResolverIndex(payload, asset),
      asset.byte_length,
      asset.content_type,
      asset.url,
      asset.normalized_url,
      manifestJson,
    )
    .run();
}

export function contentSha256ForResolverIndex(
  payload: Pick<ValidatorCallbackPayload, "raw_validator_json">,
  asset: { sha256?: string | null },
): string | null {
  return mediaSha256FromRawValidatorJson(payload.raw_validator_json) ?? validSha256(asset.sha256) ?? null;
}

export function applySourceContextPolicy(
  normalized: NormalizedValidation,
  asset: { url: string; normalized_url?: string | null; domain?: string | null; source_url?: string | null },
): NormalizedValidation {
  if (normalized.publicCategory !== "real" && normalized.publicCategory !== "edited") return normalized;

  const assetUrl = parseUrl(asset.normalized_url || asset.url);
  if (!assetUrl || !isFotoForensicsOriginalUrl(assetUrl)) return normalized;
  if (CONTEXT_ALLOWLISTED_FOTOF_FORENSICS_ORIGINALS.has(normalizeUrl(new URL(assetUrl.toString())))) return normalized;

  return {
    classification: "source_context_unverified",
    publicCategory: "diagnostic",
    warning: `FotoForensics is an analysis host, not capture provenance; explicit source context is required before public classification. Review: ${HACKER_FACTOR_PIXEL_10_POST}`,
  };
}

export function mediaFetchHeadersForTest(url: URL, accept: string, range?: string): Record<string, string> {
  return mediaFetchHeaders(url, accept, range);
}

async function recordSecurityEvent(env: RuntimeEnv, eventType: string, keyId: string | null, reason: string, body: string): Promise<void> {
  await env.DB.prepare("insert into security_events (event_type, key_id, reason, body_sha256) values (?, ?, ?, ?)")
    .bind(eventType, keyId, reason, await sha256Hex(body))
    .run();
}

function parseDiscoverySources(body: Record<string, unknown>): DiscoveryInput[] {
  const rawSources = Array.isArray(body.sources) ? body.sources : [];
  if (rawSources.length) {
    const sources: DiscoveryInput[] = [];
    for (const source of rawSources) {
      if (!source || typeof source !== "object") continue;
        const record = source as Record<string, unknown>;
        if (typeof record.type !== "string" || typeof record.value !== "string") continue;
        sources.push({
          type: record.type as DiscoveryInput["type"],
          value: record.value,
          provider: typeof record.provider === "string" ? record.provider : undefined,
        });
    }
    return sources;
  }
  if (typeof body.url === "string") return [{ type: "manual_seed", value: body.url }];
  return [];
}

async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function normalizeUrl(url: URL): string {
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  return url.toString();
}

function isLinkedInPageUrl(url: URL): boolean {
  return url.hostname === "www.linkedin.com" || url.hostname === "linkedin.com";
}

function methodology(env: RuntimeEnv): Record<string, unknown> {
  return {
    methodology_version: env.METHODOLOGY_VERSION,
    product: "C2PA-validated real-image search",
    public_categories: ["real", "edited"],
    excluded: ["pure AI-generated / AI-disclosed synthetic assets"],
    limitations: [
      "Absence of C2PA is unknown, not evidence of AI generation.",
      "Private, authenticated, blocked, robots-disallowed, unsafe, and unsupported media are outside public coverage claims.",
      "Marker scanning is a prefilter only; public classification comes from validator metadata.",
      "Platform-rendered badge summaries, such as public LinkedIn Content Credentials attributes, are stored separately from embedded-manifest validation and remain diagnostic unless the media itself validates.",
      "Soft-binding recovered manifests remain diagnostic unless the recovered manifest is separately validated and linked back to the asset under the C2PA trust model.",
      "FotoForensics-hosted assets are treated as analysis-host specimens, not capture-source proof; they stay diagnostic unless surrounding source context explicitly identifies the exact asset as a camera-original or edited example.",
    ],
    discovery_sources: [
      "Common Crawl",
      "search APIs",
      "sitemaps",
      "RSS/Atom",
      "known public repositories",
      "manual seeds",
      "platform badge metadata when permitted",
      "configured C2PA soft-binding resolver endpoints",
    ],
  };
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256HexBytes(value: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", value);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function mediaAssetObjectKey(mediaAssetId: number): string {
  return `media-assets/${mediaAssetId}/original`;
}

function mediaFetchHeaders(url: URL, accept: string, range?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "user-agent": USER_AGENT,
    accept,
  };

  if (isFotoForensicsOriginalUrl(url)) {
    headers["user-agent"] = BROWSER_IMAGE_USER_AGENT;
    headers.accept = "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8";
    headers.referer = "https://fotoforensics.com/";
  }

  if (range) headers.range = range;
  return headers;
}

function isFotoForensicsOriginalUrl(url: URL): boolean {
  return (
    (url.hostname === "fotoforensics.com" || url.hostname === "www.fotoforensics.com") &&
    url.pathname === "/analysis.php" &&
    url.searchParams.get("fmt") === "orig"
  );
}

function inferMediaContentType(bytes: Uint8Array, declaredType: string): string {
  const normalized = declaredType.split(";")[0].trim().toLowerCase();
  if (normalized.startsWith("image/")) return normalized;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif";
  if (asciiAt(bytes, 8, 4) === "WEBP") return "image/webp";
  if (asciiAt(bytes, 4, 4) === "ftyp" && /avif|avis/.test(asciiAt(bytes, 8, 8))) return "image/avif";
  return normalized || "application/octet-stream";
}

function asciiAt(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}

function mediaByteLength(response: Response, sampledByteLength: number): number {
  const contentRange = /^bytes\s+\d+-\d+\/(\d+)$/i.exec(response.headers.get("content-range") ?? "");
  if (contentRange) {
    const total = Number(contentRange[1]);
    if (Number.isFinite(total)) return total;
  }
  const contentLength = Number(response.headers.get("content-length") || 0);
  return Number.isFinite(contentLength) && contentLength > 0 ? contentLength : sampledByteLength;
}

function isCompleteFetchedBody(response: Response, byteLength: number): boolean {
  if (response.status !== 206) return true;
  const match = /^bytes\s+0-(\d+)\/(\d+)$/i.exec(response.headers.get("content-range") ?? "");
  if (!match) return false;
  const end = Number(match[1]);
  const total = Number(match[2]);
  return Number.isFinite(end) && Number.isFinite(total) && end + 1 === total && byteLength === total;
}

function mediaSha256FromRawValidatorJson(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return validSha256((value as { media_sha256?: unknown }).media_sha256);
}

function validSha256(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(normalized) ? normalized : null;
}

function bearerToken(value: string | null): string | null {
  if (!value) return null;
  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  return match ? match[1] : null;
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

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function html(body: string): Response {
  return new Response(body, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
