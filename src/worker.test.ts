import { describe, expect, it, vi } from "vitest";

import worker, { applySourceContextPolicy, buildAssetQuery, buildValidationJobsQuery, contentSha256ForResolverIndex, mediaFetchHeadersForTest, linkedInClaimToMediaCandidate, normalizeValidatorPayload, shouldReplaceLatestValidation, softBindingRecordFromPayload } from "./index";
import type { CorpusClassification, PublicCategory } from "./taxonomy";
import { renderAssetForTest } from "./ui";

interface AssetRow {
  id: number;
  url: string;
  normalized_url: string;
  domain: string;
  source_type: string;
  source_url: string;
  classification: CorpusClassification;
  public_category: PublicCategory;
  validation_status: string;
  signer: string | null;
  claim_generator: string | null;
  content_type: string | null;
  latest_validated_at: string | null;
  created_at: string;
  platform_claim_source?: string | null;
  platform_claim_app?: string | null;
  platform_claim_issued_by?: string | null;
  platform_claim_issued_at?: string | null;
  platform_claim_ai_disclosure?: string | null;
  platform_claim_category_hint?: string | null;
  platform_claim_json?: string | null;
  cached_object_key?: string | null;
  cached_content_type?: string | null;
  cached_at?: string | null;
}

interface SoftBindingIndexRow {
  manifest_id: string;
  media_asset_id: number;
  validation_attempt_id: number;
  alg: string;
  content_sha256: string | null;
  byte_length: number | null;
  content_type: string | null;
  reference_url: string;
  normalized_url: string;
  manifest_json: string;
}

class FakeQueue {
  public messages: unknown[] = [];
  async send(message: unknown): Promise<void> {
    this.messages.push(message);
  }
}

class FakeR2Object {
  constructor(
    private readonly bytes: Uint8Array,
    private readonly contentType: string,
  ) {}

  writeHttpMetadata(headers: Headers): void {
    headers.set("content-type", this.contentType);
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    return new Uint8Array(this.bytes).buffer;
  }
}

class FakeR2 {
  public objects = new Map<string, { bytes: Uint8Array; contentType: string }>();

  async put(key: string, value: ArrayBuffer | ArrayBufferView, options?: { httpMetadata?: { contentType?: string } }): Promise<void> {
    const bytes = value instanceof ArrayBuffer
      ? new Uint8Array(value)
      : new Uint8Array(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
    this.objects.set(key, { bytes, contentType: options?.httpMetadata?.contentType ?? "application/octet-stream" });
  }

  async get(key: string): Promise<FakeR2Object | null> {
    const object = this.objects.get(key);
    return object ? new FakeR2Object(object.bytes, object.contentType) : null;
  }
}

class FakePreparedStatement {
  constructor(
    private readonly db: FakeD1,
    private readonly sql: string,
    private readonly values: unknown[] = [],
  ) {}

  bind(...values: unknown[]): FakePreparedStatement {
    return new FakePreparedStatement(this.db, this.sql, values);
  }

  async all(): Promise<{ results: unknown[] }> {
    return { results: this.db.all(this.sql, this.values) };
  }

  async first<T>(): Promise<T | null> {
    return (this.db.first(this.sql, this.values) as T | null) ?? null;
  }

  async run(): Promise<{ success: boolean; meta: { changes: number } }> {
    const changes = this.db.run(this.sql, this.values);
    return { success: true, meta: { changes } };
  }
}

class FakeD1 {
  public assets: AssetRow[] = [];
  public crawlRuns: Array<Record<string, unknown>> = [];
  public discoverySources: Array<Record<string, unknown>> = [];
  public validationJobs: Array<Record<string, unknown>> = [];
  public softBindingIndex: SoftBindingIndexRow[] = [];
  public leases: Array<Record<string, unknown>> = [];
  public securityEvents: Array<Record<string, unknown>> = [];
  public nonces = new Set<string>();

  prepare(sql: string): FakePreparedStatement {
    return new FakePreparedStatement(this, sql);
  }

  all(sql: string, values: unknown[]): unknown[] {
    if (sql.includes("group by signer, classification")) {
      const groups = new Map<string, { signer: string; classification: string; n: number }>();
      for (const asset of this.assets) {
        if (!asset.signer) continue;
        const key = `${asset.signer} ${asset.classification}`;
        const group = groups.get(key) ?? { signer: asset.signer, classification: asset.classification, n: 0 };
        group.n += 1;
        groups.set(key, group);
      }
      return [...groups.values()];
    }
    if (sql.includes("group by classification")) {
      const groups = new Map<string, { classification: string; n: number }>();
      for (const asset of this.assets) {
        const group = groups.get(asset.classification) ?? { classification: asset.classification, n: 0 };
        group.n += 1;
        groups.set(asset.classification, group);
      }
      return [...groups.values()];
    }
    if (sql.includes("group by public_category")) {
      const groups = new Map<string, { public_category: string; n: number; last_validated_at: string | null }>();
      for (const asset of this.assets) {
        if (asset.public_category !== "real" && asset.public_category !== "edited") continue;
        const group = groups.get(asset.public_category) ?? { public_category: asset.public_category, n: 0, last_validated_at: null };
        group.n += 1;
        if (asset.latest_validated_at && (!group.last_validated_at || asset.latest_validated_at > group.last_validated_at)) {
          group.last_validated_at = asset.latest_validated_at;
        }
        groups.set(asset.public_category, group);
      }
      return [...groups.values()];
    }
    if (sql.includes("from media_assets")) {
      return this.assets
        .filter((asset) => asset.public_category === "real" || asset.public_category === "edited")
        .filter((asset) => !values.includes("edited") || asset.public_category === "edited")
        .sort((a, b) => String(b.latest_validated_at).localeCompare(String(a.latest_validated_at)) || b.id - a.id)
        .slice(0, Number(values.at(-1) ?? 100));
    }
    if (sql.includes("from crawl_runs")) {
      return this.crawlRuns;
    }
    if (sql.includes("from validation_attempts")) {
      return this.validationJobs;
    }
    if (sql.includes("from soft_binding_index")) {
      if (sql.includes("content_sha256 = ?")) {
        return this.softBindingIndex.filter((row) => row.content_sha256 === values[0]).slice(0, Number(values.at(-1) ?? 10));
      }
      if (sql.includes("normalized_url = ?")) {
        return this.softBindingIndex.filter((row) => row.normalized_url === values[0]).slice(0, Number(values.at(-1) ?? 10));
      }
      return this.softBindingIndex.slice(0, Number(values.at(-1) ?? 10));
    }
    return [];
  }

  first(sql: string, values: unknown[]): unknown | null {
    if (sql.includes("count(distinct domain)")) {
      const dates = this.assets.map((asset) => asset.created_at).sort();
      return {
        total: this.assets.length,
        domains: new Set(this.assets.map((asset) => asset.domain)).size,
        first_seen: dates[0] ?? null,
        last_seen: dates.at(-1) ?? null,
      };
    }
    if (sql.includes("insert into crawl_runs")) {
      const row = { id: this.crawlRuns.length + 1, source_type: values[0], seed_url: values[1], status: "queued" };
      this.crawlRuns.push(row);
      return row;
    }
    if (sql.includes("insert into media_assets")) {
      const existing = this.assets.find((asset) => asset.normalized_url === values[1]);
      if (existing) {
        if (values[7]) {
          existing.source_type = String(values[3]);
          existing.source_url = String(values[4]);
          existing.platform_claim_source = values[7] as string;
          existing.platform_claim_app = values[8] as string | null;
          existing.platform_claim_issued_by = values[9] as string | null;
          existing.platform_claim_issued_at = values[10] as string | null;
          existing.platform_claim_ai_disclosure = values[11] as string | null;
          existing.platform_claim_category_hint = values[12] as string | null;
          existing.platform_claim_json = values[13] as string | null;
        }
        return { id: existing.id, url: existing.url };
      }
      const row: AssetRow = {
        id: this.assets.length + 1,
        url: String(values[0]),
        normalized_url: String(values[1]),
        domain: String(values[2]),
        source_type: String(values[3]),
        source_url: String(values[4]),
        classification: "stripped_or_unknown",
        public_category: "diagnostic",
        validation_status: "pending",
        signer: null,
        claim_generator: null,
        content_type: null,
        latest_validated_at: null,
        created_at: "2026-06-27T00:00:00.000Z",
        platform_claim_source: values[7] as string | null,
        platform_claim_app: values[8] as string | null,
        platform_claim_issued_by: values[9] as string | null,
        platform_claim_issued_at: values[10] as string | null,
        platform_claim_ai_disclosure: values[11] as string | null,
        platform_claim_category_hint: values[12] as string | null,
        platform_claim_json: values[13] as string | null,
      };
      this.assets.push(row);
      return { id: row.id, url: row.url };
    }
    if (sql.includes("select id, url from media_assets")) {
      const found = this.assets.find((asset) => asset.normalized_url === values[0]);
      return found ? { id: found.id, url: found.url } : null;
    }
    if (sql.includes("insert into discovery_sources")) {
      const row = { id: this.discoverySources.length + 1, crawl_run_id: values[0], source_type: values[1], provider: values[2] };
      this.discoverySources.push(row);
      return row;
    }
    if (sql.includes("select 1 from validator_callback_nonces")) {
      return this.nonces.has(`${values[0]}:${values[1]}`) ? { found: 1 } : null;
    }
    if (sql.includes("from media_assets") && sql.includes("where id = ?")) {
      const found = this.assets.find((asset) => {
        if (asset.id !== values[0]) return false;
        if (sql.includes("public_category in")) {
          return asset.public_category === "real" || asset.public_category === "edited";
        }
        return true;
      });
      return found ?? null;
    }
    if (sql.includes("from soft_binding_index") && sql.includes("manifest_id = ?")) {
      return this.softBindingIndex.find((row) => row.manifest_id === values[0]) ?? null;
    }
    return null;
  }

  run(sql: string, values: unknown[]): number {
    if (sql.includes("update validation_attempts") && sql.includes("lease_owner")) {
      this.leases.push({ lease_owner: values[0], lease_expires_at: values[1], id: values[2] });
      return 1;
    }
    if (sql.includes("insert into validator_callback_nonces")) {
      this.nonces.add(`${values[0]}:${values[1]}`);
      return 1;
    }
    if (sql.includes("insert into security_events")) {
      this.securityEvents.push({ event_type: values[0], key_id: values[1], reason: values[2] });
      return 1;
    }
    if (sql.includes("insert into soft_binding_index")) {
      const row: SoftBindingIndexRow = {
        media_asset_id: Number(values[0]),
        validation_attempt_id: Number(values[1]),
        manifest_id: String(values[2]),
        alg: String(values[3]),
        content_sha256: values[4] as string | null,
        byte_length: values[5] as number | null,
        content_type: values[6] as string | null,
        reference_url: String(values[7]),
        normalized_url: String(values[8]),
        manifest_json: String(values[9]),
      };
      const index = this.softBindingIndex.findIndex((existing) => existing.manifest_id === row.manifest_id);
      if (index >= 0) this.softBindingIndex[index] = row;
      else this.softBindingIndex.push(row);
      return 1;
    }
    if (sql.includes("insert into source_pages") || sql.includes("update crawl_runs")) {
      return 1;
    }
    return 0;
  }
}

function env(db = new FakeD1()): Parameters<typeof worker.fetch>[1] {
  return {
    DB: db as unknown as D1Database,
    DISCOVERY_QUEUE: new FakeQueue() as unknown as Queue,
    FETCH_QUEUE: new FakeQueue() as unknown as Queue,
    VALIDATE_QUEUE: new FakeQueue() as unknown as Queue,
    ASSETS: new FakeR2() as unknown as R2Bucket,
    METHODOLOGY_VERSION: "c2pa-hub-v2-2026-06-27" as const,
    VALIDATOR_KEY_ID: "validator-prod-2026-06" as const,
    VALIDATOR_CALLBACK_SECRET: "callback-secret",
    VALIDATOR_PULL_SECRET: "pull-secret",
  } as Parameters<typeof worker.fetch>[1];
}

const testCtx = {
  waitUntil: (promise: Promise<unknown>) => {
    void promise;
  },
  passThroughOnException: vi.fn(),
  props: {},
} as unknown as ExecutionContext;

describe("Worker v2 API", () => {
  it("selects digital source type for public asset API rows", () => {
    expect(buildAssetQuery({ limit: 20, limitClamped: false, includeExcludedAi: false, includeDiagnostics: false }).sql).toMatch(/digital_source_type/);
  });

  it("selects and searches platform claim metadata separately from embedded validation fields", () => {
    const query = buildAssetQuery({ limit: 20, limitClamped: false, includeExcludedAi: false, includeDiagnostics: true, q: "Google LLC" });

    expect(query.sql).toMatch(/platform_claim_app/);
    expect(query.sql).toMatch(/platform_claim_issued_by/);
    expect(query.sql).toMatch(/platform_claim_category_hint/);
    expect(query.sql).toMatch(/platform_claim_issued_by like/);
  });

  it("selects soft-binding recovery metadata for diagnostic audit rows", () => {
    const query = buildAssetQuery({ limit: 20, limitClamped: false, includeExcludedAi: false, includeDiagnostics: true });

    expect(query.sql).toMatch(/soft_binding_status/);
    expect(query.sql).toMatch(/soft_binding_manifest_id/);
    expect(query.sql).toMatch(/soft_binding_recovered_at/);
  });

  it("converts LinkedIn badge summaries into diagnostic media candidates with platform metadata", () => {
    expect(
      linkedInClaimToMediaCandidate({
        platform: "linkedin",
        platformClaimSource: "linkedin_public_c2pa_badge",
        postUrl: "https://www.linkedin.com/feed/update/urn:li:activity:7457195260054540288/",
        mediaUrl: "https://media.licdn.com/dms/image/v2/D5622AQEpStyoPJcF_w/feedshare-shrink_800/B56Z31Hkl0K0Ac-/0/1777933897064?e=2147483647&v=beta&t=token",
        app: "Google C2PA SDK for Android",
        issuedBy: "Google LLC",
        issuedAt: "May 1, 2026",
        aiDisclosure: null,
        categoryHint: "real",
        ordinal: 0,
      }),
    ).toMatchObject({
      candidate: {
        url: "https://media.licdn.com/dms/image/v2/D5622AQEpStyoPJcF_w/feedshare-shrink_800/B56Z31Hkl0K0Ac-/0/1777933897064?e=2147483647&v=beta&t=token",
        sourceType: "linkedin_public_post",
        sourceUrl: "https://www.linkedin.com/feed/update/urn:li:activity:7457195260054540288/",
        attribute: "linkedin:c2pa_badge",
        ordinal: 0,
      },
      platform: {
        platformClaimSource: "linkedin_public_c2pa_badge",
        platformClaimApp: "Google C2PA SDK for Android",
        platformClaimIssuedBy: "Google LLC",
        platformClaimIssuedAt: "May 1, 2026",
        platformClaimAiDisclosure: null,
        platformClaimCategoryHint: "real",
      },
    });
  });

  it("allows external validation to rescue edge prefetch failures", () => {
    expect(buildValidationJobsQuery().sql).toMatch(/'fetch_failed'/);
  });

  it("does not let a validator fetch failure replace an existing trusted public classification", () => {
    expect(
      shouldReplaceLatestValidation(
        { validationStatus: "valid", publicCategory: "real", trustStatus: "trusted" },
        { status: "fetch_failed" },
      ),
    ).toBe(false);
    expect(
      shouldReplaceLatestValidation(
        { validationStatus: "valid", publicCategory: "edited", trustStatus: "trusted" },
        { status: "fetch_failed" },
      ),
    ).toBe(false);
    expect(
      shouldReplaceLatestValidation(
        { validationStatus: "valid", publicCategory: "diagnostic", trustStatus: "untrusted" },
        { status: "fetch_failed" },
      ),
    ).toBe(true);
    expect(
      shouldReplaceLatestValidation(
        { validationStatus: "valid", publicCategory: "real", trustStatus: "trusted" },
        { status: "invalid" },
      ),
    ).toBe(true);
    expect(
      shouldReplaceLatestValidation(
        { validationStatus: "valid", publicCategory: "real", trustStatus: "trusted" },
        { status: "no_manifest" },
      ),
    ).toBe(false);
  });

  it("normalizes recovered soft-binding manifests as diagnostic recovery evidence", () => {
    expect(
      normalizeValidatorPayload({
        media_asset_id: 1,
        status: "no_manifest",
        manifest_present: false,
        soft_binding: {
          status: "recovered",
          resolver_name: "trustmark",
          lookup_method: "byContent",
          manifest_id: "urn:c2pa:recovered",
          manifest_url: "https://resolver.example/manifests/urn%3Ac2pa%3Arecovered",
          similarity_score: 94,
        },
      }),
    ).toEqual({ classification: "soft_binding_recovered", publicCategory: "diagnostic" });
  });

  it("maps recovered soft-binding callback metadata to persistence columns", () => {
    expect(
      softBindingRecordFromPayload({
        media_asset_id: 1,
        status: "no_manifest",
        soft_binding: {
          status: "recovered",
          resolver_name: "trustmark",
          lookup_method: "byContent",
          manifest_id: "urn:c2pa:recovered",
          manifest_url: "https://resolver.example/manifests/urn%3Ac2pa%3Arecovered",
          similarity_score: 94,
        },
      }),
    ).toEqual({
      status: "recovered",
      resolver: "trustmark",
      lookupMethod: "byContent",
      manifestId: "urn:c2pa:recovered",
      manifestUrl: "https://resolver.example/manifests/urn%3Ac2pa%3Arecovered",
      similarity: 94,
    });
  });

  it("serves public assets while excluding pure AI-generated assets by default", async () => {
    const db = new FakeD1();
    db.assets = [
      {
        id: 1,
        url: "https://example.com/real.jpg",
        normalized_url: "https://example.com/real.jpg",
        domain: "example.com",
        source_type: "search_api",
        source_url: "https://search.example",
        classification: "trusted_camera_capture",
        public_category: "real",
        validation_status: "valid",
        signer: "Pixel Camera",
        claim_generator: "Pixel Camera",
        content_type: "image/jpeg",
        latest_validated_at: "2026-06-27T00:00:00.000Z",
        created_at: "2026-06-27T00:00:00.000Z",
      },
      {
        id: 2,
        url: "https://example.com/ai.jpg",
        normalized_url: "https://example.com/ai.jpg",
        domain: "example.com",
        source_type: "search_api",
        source_url: "https://search.example",
        classification: "ai_disclosed",
        public_category: "excluded_ai_generated",
        validation_status: "valid",
        signer: "Generator",
        claim_generator: "Generator",
        content_type: "image/jpeg",
        latest_validated_at: "2026-06-27T00:01:00.000Z",
        created_at: "2026-06-27T00:01:00.000Z",
      },
    ];

    const response = await worker.fetch(new Request("https://c2pa.mutual.solutions/api/assets"), env(db), testCtx);
    const body = (await response.json()) as { assets: AssetRow[] };

    expect(response.status).toBe(200);
    expect(body.assets.map((asset) => asset.url)).toEqual(["https://example.com/real.jpg"]);
  });

  it("reports public corpus stats without counting excluded or diagnostic assets", async () => {
    const db = new FakeD1();
    const baseAsset = {
      url: "https://example.com/a.jpg",
      normalized_url: "https://example.com/a.jpg",
      domain: "example.com",
      source_type: "manual_seed",
      source_url: "https://example.com/a.jpg",
      validation_status: "valid",
      signer: "Camera",
      claim_generator: "Camera",
      content_type: "image/jpeg",
      created_at: "2026-06-27T00:00:00.000Z",
    };
    db.assets = [
      { ...baseAsset, id: 1, classification: "trusted_camera_capture", public_category: "real", latest_validated_at: "2026-06-27T00:01:00.000Z" },
      { ...baseAsset, id: 2, classification: "trusted_camera_capture", public_category: "real", latest_validated_at: "2026-06-28T00:01:00.000Z" },
      { ...baseAsset, id: 3, classification: "trusted_edited", public_category: "edited", latest_validated_at: "2026-06-26T00:01:00.000Z" },
      { ...baseAsset, id: 4, classification: "ai_disclosed", public_category: "excluded_ai_generated", latest_validated_at: "2026-06-29T00:01:00.000Z" },
      { ...baseAsset, id: 5, classification: "stripped_or_unknown", public_category: "diagnostic", latest_validated_at: "2026-06-30T00:01:00.000Z" },
    ];

    const response = await worker.fetch(new Request("https://c2pa.mutual.solutions/api/stats"), env(db), testCtx);
    const body = (await response.json()) as { real_count: number; edited_count: number; last_validated_at: string };

    expect(response.status).toBe(200);
    expect(body.real_count).toBe(2);
    expect(body.edited_count).toBe(1);
    expect(body.last_validated_at).toBe("2026-06-28T00:01:00.000Z");
  });

  it("serves the ecosystem landscape page with measured aggregates", async () => {
    const db = new FakeD1();
    const baseAsset = {
      url: "https://example.com/a.jpg",
      normalized_url: "https://example.com/a.jpg",
      domain: "example.com",
      source_type: "manual_seed",
      source_url: "https://example.com/a.jpg",
      validation_status: "valid",
      signer: "Pixel Camera",
      claim_generator: "Pixel Camera",
      content_type: "image/jpeg",
      created_at: "2026-06-27T00:00:00.000Z",
    };
    db.assets = [
      { ...baseAsset, id: 1, classification: "trusted_camera_capture", public_category: "real", latest_validated_at: "2026-06-27T00:01:00.000Z" },
      { ...baseAsset, id: 2, classification: "c2pa_present_untrusted", public_category: "diagnostic", latest_validated_at: "2026-06-28T00:01:00.000Z", signer: "Test Signer" },
      { ...baseAsset, id: 3, classification: "stripped_or_unknown", public_category: "diagnostic", latest_validated_at: null, signer: null },
      { ...baseAsset, id: 4, classification: "c2pa_invalid", public_category: "diagnostic", latest_validated_at: null, signer: "Test Signer" },
    ];

    const response = await worker.fetch(new Request("https://c2pa.mutual.solutions/landscape"), env(db), testCtx);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(body).toContain("The provenance funnel");
    expect(body).toContain("The trust gap");
    expect(body).toContain("Pixel Camera");
    expect(body).toContain("Why adoption is stuck");
  });

  it("serves the test-asset library and resources pages", async () => {
    const db = new FakeD1();
    db.assets = [
      {
        id: 1,
        url: "https://example.com/a.jpg",
        normalized_url: "https://example.com/a.jpg",
        domain: "example.com",
        source_type: "manual_seed",
        source_url: "https://example.com/a.jpg",
        classification: "trusted_camera_capture",
        public_category: "real",
        validation_status: "valid",
        signer: "Pixel Camera",
        claim_generator: "Pixel Camera",
        content_type: "image/jpeg",
        latest_validated_at: "2026-06-27T00:01:00.000Z",
        created_at: "2026-06-27T00:00:00.000Z",
        cached_object_key: "media-assets/1/original",
      },
    ];

    const assetsResponse = await worker.fetch(new Request("https://c2pa.mutual.solutions/assets"), env(db), testCtx);
    const assetsBody = await assetsResponse.text();
    expect(assetsResponse.status).toBe(200);
    expect(assetsBody).toContain("Validated samples, manifests intact.");
    expect(assetsBody).toContain("Download original");
    expect(assetsBody).toContain("/?asset=1");

    const resourcesResponse = await worker.fetch(new Request("https://c2pa.mutual.solutions/resources"), env(), testCtx);
    const resourcesBody = await resourcesResponse.text();
    expect(resourcesResponse.status).toBe(200);
    expect(resourcesBody).toContain("c2paviewer.com");
    expect(resourcesBody).toContain("conformance-explorer");
  });

  it("serves the designed methodology page at /methodology", async () => {
    const response = await worker.fetch(new Request("https://c2pa.mutual.solutions/methodology"), env(), testCtx);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(body).toContain("Public taxonomy");
    expect(body).toContain("c2pa-hub-v2-2026-06-27");
  });

  it("documents soft-binding recovery as diagnostic rather than public validation", async () => {
    const response = await worker.fetch(new Request("https://c2pa.mutual.solutions/api/methodology"), env(), testCtx);
    const body = (await response.json()) as { limitations: string[]; discovery_sources: string[] };

    expect(response.status).toBe(200);
    expect(body.limitations.join(" ")).toMatch(/soft-binding recovered manifests remain diagnostic/i);
    expect(body.discovery_sources.join(" ")).toMatch(/soft-binding resolver/i);
  });

  it("keeps uncontextualized FotoForensics C2PA captures out of public real search", () => {
    const result = applySourceContextPolicy(
      { classification: "trusted_camera_capture", publicCategory: "real" },
      { url: "https://fotoforensics.com/analysis.php?id=unknown.123&fmt=orig" },
    );

    expect(result).toMatchObject({
      classification: "source_context_unverified",
      publicCategory: "diagnostic",
    });
  });

  it("allows explicitly documented FotoForensics camera-original samples", () => {
    const result = applySourceContextPolicy(
      { classification: "trusted_camera_capture", publicCategory: "real" },
      { url: "https://fotoforensics.com/analysis.php?id=8204a32ac89368dccb181692c0ed8ea9cc7cb6be.1490652&fmt=orig" },
    );

    expect(result).toEqual({ classification: "trusted_camera_capture", publicCategory: "real" });
  });

  it("serves first-party soft-binding resolver matches by content and manifest id", async () => {
    const db = new FakeD1();
    db.softBindingIndex = [
      {
        manifest_id: "urn:mutual:c2pa:asset:42:attempt:7",
        media_asset_id: 42,
        validation_attempt_id: 7,
        alg: "com.mutual.sha256.v1",
        content_sha256: "039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81",
        byte_length: 3,
        content_type: "image/jpeg",
        reference_url: "https://example.com/photo.jpg",
        normalized_url: "https://example.com/photo.jpg",
        manifest_json: JSON.stringify({ media_asset_id: 42, validation_attempt_id: 7 }),
      },
    ];

    const matchResponse = await worker.fetch(
      new Request("https://c2pa.mutual.solutions/soft-binding/matches/byContent?maxResults=5", {
        method: "POST",
        headers: { "content-type": "image/jpeg" },
        body: new Uint8Array([1, 2, 3]),
      }),
      env(db),
      testCtx,
    );
    const matchBody = (await matchResponse.json()) as { matches: Array<{ manifestId: string; endpoint: string; similarityScore: number }> };

    expect(matchResponse.status).toBe(200);
    expect(matchBody.matches).toEqual([
      {
        manifestId: "urn:mutual:c2pa:asset:42:attempt:7",
        endpoint: "https://c2pa.mutual.solutions/soft-binding",
        similarityScore: 100,
      },
    ]);

    const manifestResponse = await worker.fetch(
      new Request("https://c2pa.mutual.solutions/soft-binding/manifests/urn%3Amutual%3Ac2pa%3Aasset%3A42%3Aattempt%3A7"),
      env(db),
      testCtx,
    );
    expect(manifestResponse.status).toBe(200);
    expect(manifestResponse.headers.get("content-type")).toContain("application/json");
    await expect(manifestResponse.json()).resolves.toMatchObject({ media_asset_id: 42, validation_attempt_id: 7 });
  });

  it("serves first-party soft-binding resolver matches by reference URL", async () => {
    const db = new FakeD1();
    db.softBindingIndex = [
      {
        manifest_id: "urn:mutual:c2pa:asset:42:attempt:7",
        media_asset_id: 42,
        validation_attempt_id: 7,
        alg: "com.mutual.reference-url.v1",
        content_sha256: null,
        byte_length: null,
        content_type: "image/jpeg",
        reference_url: "https://example.com/photo.jpg",
        normalized_url: "https://example.com/photo.jpg",
        manifest_json: "{}",
      },
    ];

    const response = await worker.fetch(
      new Request("https://c2pa.mutual.solutions/soft-binding/matches/byReference?maxResults=5", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ referenceUrl: "https://example.com/photo.jpg", assetLength: 10, assetType: "image/jpeg" }),
      }),
      env(db),
      testCtx,
    );
    const body = (await response.json()) as { matches: Array<{ manifestId: string; endpoint: string; similarityScore: number }> };

    expect(response.status).toBe(200);
    expect(body.matches).toEqual([
      {
        manifestId: "urn:mutual:c2pa:asset:42:attempt:7",
        endpoint: "https://c2pa.mutual.solutions/soft-binding",
        similarityScore: 100,
      },
    ]);
  });

  it("indexes resolver content matches with the validator full-file hash when present", () => {
    expect(
      contentSha256ForResolverIndex(
        { raw_validator_json: { media_sha256: "a".repeat(64) } },
        { sha256: "b".repeat(64) },
      ),
    ).toBe("a".repeat(64));

    expect(
      contentSha256ForResolverIndex(
        { raw_validator_json: { media_sha256: "not-a-sha" } },
        { sha256: "b".repeat(64) },
      ),
    ).toBe("b".repeat(64));
  });

  it("uses browser-compatible fetch headers for FotoForensics original image URLs", () => {
    const headers = mediaFetchHeadersForTest(
      new URL("https://fotoforensics.com/analysis.php?id=8204a32ac89368dccb181692c0ed8ea9cc7cb6be.1490652&fmt=orig"),
      "image/*,*/*;q=0.5",
    );

    expect(headers.referer).toBe("https://fotoforensics.com/");
    expect(headers["user-agent"]).toContain("Mozilla/5.0");
    expect(headers.accept).toContain("image/");
  });

  it("serves cached corpus images for FotoForensics-style octet-stream rows", async () => {
    const db = new FakeD1();
    const testEnv = env(db);
    db.assets = [
      {
        id: 792,
        url: "https://fotoforensics.com/analysis.php?id=8204a32ac89368dccb181692c0ed8ea9cc7cb6be.1490652&fmt=orig",
        normalized_url: "https://fotoforensics.com/analysis.php?id=8204a32ac89368dccb181692c0ed8ea9cc7cb6be.1490652&fmt=orig",
        domain: "fotoforensics.com",
        source_type: "manual_seed",
        source_url: "https://fotoforensics.com/",
        classification: "trusted_camera_capture",
        public_category: "real",
        validation_status: "valid",
        signer: "Pixel Camera",
        claim_generator: "Pixel Camera",
        content_type: "application/octet-stream",
        latest_validated_at: "2026-06-27T00:00:00.000Z",
        created_at: "2026-06-27T00:00:00.000Z",
        cached_object_key: "media-assets/792/original",
        cached_content_type: "image/jpeg",
      },
    ];
    await testEnv.ASSETS.put("media-assets/792/original", new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), {
      httpMetadata: { contentType: "image/jpeg" },
    });

    const response = await worker.fetch(new Request("https://c2pa.mutual.solutions/api/image/792"), testEnv, testCtx);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]));
  });

  it("proxies and caches large Proofmode GitLab JPEGs used in public cards", async () => {
    const db = new FakeD1();
    const testEnv = env(db);
    const bytes = new Uint8Array(7_952_777);
    bytes.set([0xff, 0xd8, 0xff, 0xd9]);
    db.assets = [
      {
        id: 700,
        url: "https://gitlab.com/guardianproject/proofmode/proofmode-c2pa-sample-media/-/raw/main/proofmode-ios/OPENED/googleinterop-cec67dcda3978063-2026-06-15-14-42-57EDT/photo_1781548808114.jpg",
        normalized_url: "https://gitlab.com/guardianproject/proofmode/proofmode-c2pa-sample-media/-/raw/main/proofmode-ios/OPENED/googleinterop-cec67dcda3978063-2026-06-15-14-42-57EDT/photo_1781548808114.jpg",
        domain: "gitlab.com",
        source_type: "known_repository",
        source_url: "https://gitlab.com/guardianproject/proofmode/proofmode-c2pa-sample-media",
        classification: "trusted_camera_capture",
        public_category: "real",
        validation_status: "valid",
        signer: "Pixel Camera",
        claim_generator: null,
        content_type: "image/jpeg",
        latest_validated_at: "2026-06-27T09:35:14.155Z",
        created_at: "2026-06-27T09:35:14.155Z",
      },
    ];
    const fetchSpy = vi.fn(async () => new Response(bytes, {
      headers: {
        "content-type": "image/jpeg",
        "content-length": String(bytes.byteLength),
      },
    }));
    vi.stubGlobal("fetch", fetchSpy);

    try {
      const response = await worker.fetch(new Request("https://c2pa.mutual.solutions/api/image/700"), testEnv, testCtx);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/jpeg");
      expect((await response.arrayBuffer()).byteLength).toBe(bytes.byteLength);
      await expect(testEnv.ASSETS.get("media-assets/700/original")).resolves.not.toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("renders FotoForensics octet-stream assets through the corpus image proxy", () => {
    const html = renderAssetForTest({
      id: 792,
      url: "https://fotoforensics.com/analysis.php?id=8204a32ac89368dccb181692c0ed8ea9cc7cb6be.1490652&fmt=orig",
      content_type: "application/octet-stream",
      public_category: "real",
      classification: "trusted_camera_capture",
    });

    expect(html).toContain('/api/image/792');
    expect(html).not.toContain('src="https://fotoforensics.com');
  });

  it("creates crawl runs with discovery provenance and queues discovery work", async () => {
    const db = new FakeD1();
    const testEnv = env(db);

    const response = await worker.fetch(
      new Request("https://c2pa.mutual.solutions/api/crawl-runs", {
        method: "POST",
        body: JSON.stringify({
          sources: [
            { type: "search_api", value: "Content Credentials image", provider: "brave" },
            { type: "sitemap", value: "https://example.com/sitemap.xml" },
          ],
        }),
      }),
      testEnv,
      testCtx,
    );

    const body = (await response.json()) as { crawl_run_id: number; release_ready: boolean };
    expect(response.status).toBe(202);
    expect(body).toMatchObject({ crawl_run_id: 1, release_ready: false });
    expect(db.discoverySources).toHaveLength(2);
    expect((testEnv.DISCOVERY_QUEUE as unknown as FakeQueue).messages).toHaveLength(2);
  });

  it("stores LinkedIn C2PA badge metadata during HTML discovery without promoting stripped CDN media", async () => {
    const db = new FakeD1();
    const testEnv = env(db);
    const waited: Promise<unknown>[] = [];
    const ack = vi.fn();
    const retry = vi.fn();
    const html = `
      <html><body>
        <img src="https://media.licdn.com/dms/image/v2/D5622AQEpStyoPJcF_w/feedshare-shrink_800/B56Z31Hkl0K0Ac-/0/1777933897064?e=2147483647&amp;v=beta&amp;t=token">
        <button class="c2pa-button"
          data-feed-action-type="viewContentCredentials"
          data-app="App or device used: Google C2PA SDK for Android"
          data-issued-by="Content Credentials issued by: Google LLC"
          data-issued-at="Content Credentials issue date: May 1, 2026">
          View C2PA information
        </button>
      </body></html>
    `;
    const fetchMock = vi.fn(async (url: string | URL) => {
      const target = url.toString();
      if (target === "https://www.linkedin.com/robots.txt") return new Response("", { status: 404 });
      if (target === "https://www.linkedin.com/posts/example") {
        return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await worker.queue?.(
      {
        messages: [
          {
            body: {
              stage: "discovery",
              crawl_run_id: 1,
              source: { sourceType: "manual_seed", value: "https://www.linkedin.com/posts/example", provider: "manual_seed", ordinal: 0 },
            },
            ack,
            retry,
          },
        ],
      } as unknown as Parameters<NonNullable<typeof worker.queue>>[0],
      testEnv,
      {
        waitUntil: (promise: Promise<unknown>) => {
          waited.push(promise);
        },
        passThroughOnException: vi.fn(),
        props: {},
      } as unknown as ExecutionContext,
    );
    await Promise.all(waited);

    expect(retry).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledOnce();
    expect(db.assets).toHaveLength(1);
    expect(db.assets[0]).toMatchObject({
      source_type: "linkedin_public_post",
      public_category: "diagnostic",
      validation_status: "pending",
      platform_claim_source: "linkedin_public_c2pa_badge",
      platform_claim_app: "Google C2PA SDK for Android",
      platform_claim_issued_by: "Google LLC",
      platform_claim_issued_at: "May 1, 2026",
      platform_claim_category_hint: "real",
    });
    expect((testEnv.FETCH_QUEUE as unknown as FakeQueue).messages).toHaveLength(1);
    vi.unstubAllGlobals();
  });

  it("uses the real scheduled execution context for broad discovery queue dispatch", async () => {
    const db = new FakeD1();
    const testEnv = env(db);
    const waited: Promise<unknown>[] = [];
    const scheduledCtx = {
      waitUntil: (promise: Promise<unknown>) => {
        waited.push(promise);
      },
      passThroughOnException: vi.fn(),
      props: {},
    } as unknown as ExecutionContext;

    await worker.scheduled?.({ cron: "17 */6 * * *", scheduledTime: Date.now() } as ScheduledController, testEnv, scheduledCtx);

    for (let i = 0; i < 3; i += 1) {
      await Promise.all(waited);
    }

    const messages = (testEnv.DISCOVERY_QUEUE as unknown as FakeQueue).messages as Array<{ source?: { sourceType?: string } }>;
    expect(waited.length).toBeGreaterThanOrEqual(2);
    expect(messages).toHaveLength(10);
    expect(new Set(messages.map((message) => message.source?.sourceType))).toEqual(
      new Set(["search_api", "known_repository", "common_crawl", "sitemap", "rss", "manual_seed"]),
    );
    expect(db.crawlRuns).toHaveLength(1);
    expect(db.discoverySources).toHaveLength(10);
  });

  it("returns bounded JSON exports with methodology metadata", async () => {
    const db = new FakeD1();
    db.assets = [
      {
        id: 1,
        url: "https://example.com/real.jpg",
        normalized_url: "https://example.com/real.jpg",
        domain: "example.com",
        source_type: "search_api",
        source_url: "https://search.example",
        classification: "trusted_camera_capture",
        public_category: "real",
        validation_status: "valid",
        signer: "Pixel Camera",
        claim_generator: "Pixel Camera",
        content_type: "image/jpeg",
        latest_validated_at: "2026-06-27T00:00:00.000Z",
        created_at: "2026-06-27T00:00:00.000Z",
      },
    ];

    const response = await worker.fetch(new Request("https://c2pa.mutual.solutions/api/export.json?limit=5000"), env(db), testCtx);
    const body = (await response.json()) as { methodology_version: string; limit_clamped: boolean; rows: AssetRow[] };

    expect(response.status).toBe(200);
    expect(body.methodology_version).toBe("c2pa-hub-v2-2026-06-27");
    expect(body.limit_clamped).toBe(true);
    expect(body.rows).toHaveLength(1);
  });

  it("rejects unsigned validator callbacks as security events", async () => {
    const db = new FakeD1();
    const response = await worker.fetch(
      new Request("https://c2pa.mutual.solutions/api/validator-callback", {
        method: "POST",
        body: JSON.stringify({ validation_attempt_id: 1 }),
      }),
      env(db),
      testCtx,
    );

    expect(response.status).toBe(401);
    expect(db.securityEvents).toHaveLength(1);
  });

  it("serves queued validator jobs through the dedicated pull-secret header", async () => {
    const db = new FakeD1();
    db.validationJobs = [
      {
        id: 1,
        validation_attempt_id: 1,
        media_asset_id: 10,
        idempotency_key: "validation:10:abc",
        media_url: "https://example.com/asset.jpg",
        content_type: "image/jpeg",
        byte_length: 123,
        source_type: "manual_seed",
        source_url: "https://example.com/",
      },
    ];

    const unauthorized = await worker.fetch(
      new Request("https://c2pa.mutual.solutions/api/validation-jobs?limit=1"),
      env(db),
      testCtx,
    );
    expect(unauthorized.status).toBe(401);

    const authorized = await worker.fetch(
      new Request("https://c2pa.mutual.solutions/api/validation-jobs?limit=1", {
        headers: { "x-mutual-validator-pull-secret": "pull-secret" },
      }),
      env(db),
      testCtx,
    );
    const body = (await authorized.json()) as { jobs: Array<{ media_asset_id: number }> };
    expect(authorized.status).toBe(200);
    expect(body.jobs).toHaveLength(1);
    expect(body.jobs[0]).toMatchObject({ media_asset_id: 10 });
  });

  it("returns a single public asset by id with methodology_version", async () => {
    const db = new FakeD1();
    db.assets = [
      {
        id: 42,
        url: "https://example.com/real.jpg",
        normalized_url: "https://example.com/real.jpg",
        domain: "example.com",
        source_type: "search_api",
        source_url: "https://search.example",
        classification: "trusted_camera_capture",
        public_category: "real",
        validation_status: "valid",
        signer: "Pixel Camera",
        claim_generator: "Pixel Camera",
        content_type: "image/jpeg",
        latest_validated_at: "2026-06-27T00:00:00.000Z",
        created_at: "2026-06-27T00:00:00.000Z",
      },
    ];

    const response = await worker.fetch(new Request("https://c2pa.mutual.solutions/api/assets/42"), env(db), testCtx);
    const body = (await response.json()) as { methodology_version: string; asset: { url: string } };

    expect(response.status).toBe(200);
    expect(body.asset.url).toBe("https://example.com/real.jpg");
    expect(body.methodology_version).toBe("c2pa-hub-v2-2026-06-27");
  });

  it("returns 404 for a diagnostic (non-public) asset id via /api/assets/:id", async () => {
    const db = new FakeD1();
    db.assets = [
      {
        id: 99,
        url: "https://example.com/diagnostic.jpg",
        normalized_url: "https://example.com/diagnostic.jpg",
        domain: "example.com",
        source_type: "manual_seed",
        source_url: "https://example.com/diagnostic.jpg",
        classification: "stripped_or_unknown",
        public_category: "diagnostic",
        validation_status: "pending",
        signer: null,
        claim_generator: null,
        content_type: "image/jpeg",
        latest_validated_at: null,
        created_at: "2026-06-27T00:00:00.000Z",
      },
    ];

    const response = await worker.fetch(new Request("https://c2pa.mutual.solutions/api/assets/99"), env(db), testCtx);
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe("not_found");
  });

  it("returns 400 for a non-numeric asset id in /api/assets/:id", async () => {
    const response = await worker.fetch(new Request("https://c2pa.mutual.solutions/api/assets/abc"), env(), testCtx);
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("invalid_id");
  });

  it("exposes MCP tools for search and crawl orchestration", async () => {
    const db = new FakeD1();
    const testEnv = env(db);
    const listResponse = await worker.fetch(
      new Request("https://c2pa.mutual.solutions/mcp", {
        method: "POST",
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      }),
      testEnv,
      testCtx,
    );
    const listed = (await listResponse.json()) as { result: { tools: Array<{ name: string }> } };
    expect(listed.result.tools.map((tool) => tool.name)).toContain("search_c2pa_images");

    const callResponse = await worker.fetch(
      new Request("https://c2pa.mutual.solutions/mcp", {
        method: "POST",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: "queue_crawl_source", arguments: { type: "search_api", value: "Content Credentials image" } },
        }),
      }),
      testEnv,
      testCtx,
    );
    const called = (await callResponse.json()) as { result: { content: Array<{ json: { crawl_run_id: number } }> } };
    expect(called.result.content[0].json.crawl_run_id).toBe(1);
  });
});
