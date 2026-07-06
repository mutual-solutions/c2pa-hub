import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { normalizeSoftBindingRecoveryCallback, parseSoftBindingResolvers, recoverSoftBindingManifest } from "./soft-binding.mjs";

describe("parseSoftBindingResolvers", () => {
  it("accepts JSON resolver config with algorithm and lookup mode", () => {
    expect(
      parseSoftBindingResolvers(
        JSON.stringify([
          {
            name: "trustmark",
            endpoint: "https://resolver.example.com/api/",
            alg: "com.example.watermark.v1",
            lookup: "byContent",
            maxResults: 3,
          },
        ]),
      ),
    ).toEqual([
      {
        name: "trustmark",
        endpoint: "https://resolver.example.com/api",
        alg: "com.example.watermark.v1",
        lookup: "byContent",
        maxResults: 3,
      },
    ]);
  });
});

describe("recoverSoftBindingManifest", () => {
  it("queries by content and downloads the first matched manifest", async () => {
    const manifestBytes = new TextEncoder().encode("fake manifest store");
    const fetcher = vi.fn(async (url, init) => {
      const target = new URL(url);
      if (target.pathname === "/matches/byContent") {
        expect(init.method).toBe("POST");
        expect(init.headers["content-type"]).toBe("image/jpeg");
        expect(target.searchParams.get("alg")).toBe("com.example.watermark.v1");
        return Response.json({
          matches: [
            {
              manifestId: "urn:c2pa:test-manifest",
              endpoint: "https://manifest.example.net/soft",
              similarityScore: 94,
            },
          ],
        });
      }
      if (target.href === "https://manifest.example.net/soft/manifests/urn%3Ac2pa%3Atest-manifest") {
        return new Response(manifestBytes, { headers: { "content-type": "application/c2pa" } });
      }
      return new Response("not found", { status: 404 });
    });

    const recovery = await recoverSoftBindingManifest({
      bytes: new Uint8Array([1, 2, 3]),
      mediaUrl: "https://cdn.example.com/photo.jpg",
      contentType: "image/jpeg",
      byteLength: 3,
      resolvers: [
        {
          name: "trustmark",
          endpoint: "https://resolver.example.com",
          alg: "com.example.watermark.v1",
          lookup: "byContent",
          maxResults: 3,
        },
      ],
      fetcher,
    });

    expect(recovery).toMatchObject({
      status: "recovered",
      lookupMethod: "byContent",
      resolverName: "trustmark",
      resolverEndpoint: "https://resolver.example.com",
      manifestEndpoint: "https://manifest.example.net/soft",
      manifestId: "urn:c2pa:test-manifest",
      similarityScore: 94,
      manifestContentType: "application/c2pa",
      manifestByteLength: manifestBytes.byteLength,
      manifestSha256: createHash("sha256").update(manifestBytes).digest("hex"),
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe("normalizeSoftBindingRecoveryCallback", () => {
  it("keeps recovered manifests as no-manifest diagnostic evidence with resolver metadata", () => {
    expect(
      normalizeSoftBindingRecoveryCallback({
        job: {
          validation_attempt_id: 7,
          media_asset_id: 11,
          idempotency_key: "validation:11:test",
        },
        recovery: {
          status: "recovered",
          resolverName: "trustmark",
          lookupMethod: "byContent",
          manifestId: "urn:c2pa:test-manifest",
          manifestUrl: "https://manifest.example.net/soft/manifests/urn%3Ac2pa%3Atest-manifest",
          similarityScore: 94,
          manifestContentType: "application/c2pa",
          manifestByteLength: 128,
          manifestSha256: "manifest-sha256",
        },
        mediaSha256: "media-sha256",
        validatorVersion: "0.26.68",
        trustAnchorsUrl: "https://trust.example/ca.pem",
        tsaTrustAnchorsUrl: "https://trust.example/tsa.pem",
        retrievedAt: "2026-06-27T00:00:00.000Z",
      }),
    ).toMatchObject({
      validation_attempt_id: 7,
      media_asset_id: 11,
      idempotency_key: "validation:11:test",
      validator_name: "github-actions-c2patool",
      validator_version: "0.26.68",
      status: "no_manifest",
      trust_status: "not_applicable",
      manifest_present: false,
      soft_binding: {
        status: "recovered",
        resolver_name: "trustmark",
        lookup_method: "byContent",
        manifest_id: "urn:c2pa:test-manifest",
        manifest_url: "https://manifest.example.net/soft/manifests/urn%3Ac2pa%3Atest-manifest",
        similarity_score: 94,
      },
      raw_validator_json: {
        media_sha256: "media-sha256",
        soft_binding: {
          manifest_content_type: "application/c2pa",
          manifest_byte_length: 128,
          manifest_sha256: "manifest-sha256",
        },
      },
      trust_list: {
        ca_source_uri: "https://trust.example/ca.pem",
        tsa_source_uri: "https://trust.example/tsa.pem",
        retrieved_at: "2026-06-27T00:00:00.000Z",
      },
      error_code: "soft_binding_recovered",
      error_detail: null,
    });
  });
});
