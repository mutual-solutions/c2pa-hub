import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = [
  "0001_initial.sql",
  "0002_v2_schema.sql",
  "0003_validator_leases.sql",
  "0004_platform_claims.sql",
  "0005_soft_binding_recovery.sql",
  "0006_first_party_soft_binding_resolver.sql",
]
  .map((file) => readFileSync(join(process.cwd(), "migrations", file), "utf8"))
  .join("\n");

describe("D1 schema", () => {
  it("declares the v2 corpus tables", () => {
    for (const table of [
      "crawl_runs",
      "discovery_sources",
      "source_pages",
      "media_assets",
      "fetch_attempts",
      "validation_attempts",
      "validation_summaries",
      "soft_binding_index",
      "validator_callback_nonces",
      "security_events",
    ]) {
      expect(migration).toContain(`create table if not exists ${table}`);
    }
  });

  it("enforces key uniqueness and replay/idempotency constraints", () => {
    expect(migration).toContain("normalized_url text not null unique");
    expect(migration).toContain("idempotency_key text not null unique");
    expect(migration).toContain("unique(key_id, nonce)");
    expect(migration).toContain("media_asset_id integer not null unique");
    expect(migration).toContain("lease_owner text");
    expect(migration).toContain("lease_expires_at text");
  });

  it("stores platform-level C2PA claim summaries separately from embedded validation results", () => {
    for (const column of [
      "platform_claim_source text",
      "platform_claim_app text",
      "platform_claim_issued_by text",
      "platform_claim_issued_at text",
      "platform_claim_ai_disclosure text",
      "platform_claim_category_hint text",
      "platform_claim_json text",
    ]) {
      expect(migration).toContain(column);
    }
  });

  it("stores soft-binding recovery metadata separately from embedded validation fields", () => {
    for (const column of [
      "soft_binding_status text",
      "soft_binding_resolver text",
      "soft_binding_lookup_method text",
      "soft_binding_manifest_id text",
      "soft_binding_manifest_url text",
      "soft_binding_similarity integer",
      "soft_binding_recovered_at text",
    ]) {
      expect(migration).toContain(column);
    }
    expect(migration).toContain("idx_media_assets_soft_binding_status");
  });

  it("stores first-party resolver bindings and cached display objects", () => {
    for (const column of [
      "cached_object_key text",
      "cached_content_type text",
      "cached_at text",
      "manifest_id text not null unique",
      "content_sha256 text",
      "normalized_url text not null",
      "manifest_json text not null",
    ]) {
      expect(migration).toContain(column);
    }
    expect(migration).toContain("idx_soft_binding_index_content_sha256");
    expect(migration).toContain("idx_soft_binding_index_normalized_url");
  });
});
