import { describe, expect, it, vi } from "vitest";

describe("validateJob soft-binding recovery gate", () => {
  it("queries soft-binding resolvers only for a structured no-manifest result", async () => {
    const { NoManifestError, validateJob } = await import("./validate-jobs.mjs");
    const recovery = {
      status: "recovered",
      resolverName: "trustmark",
      resolverEndpoint: "https://resolver.example",
      lookupMethod: "byContent",
      manifestEndpoint: "https://manifest.example/soft",
      manifestId: "urn:c2pa:manifest",
      manifestUrl: "https://manifest.example/soft/manifests/urn%3Ac2pa%3Amanifest",
      similarityScore: 91,
      manifestContentType: "application/c2pa",
      manifestByteLength: 128,
      manifestSha256: "manifest-sha256",
    };
    const recoverSoftBindingManifest = vi.fn(async () => recovery);

    const payload = await validateJob(
      {
        validation_attempt_id: 7,
        media_asset_id: 11,
        idempotency_key: "validation:11:test",
        media_url: "https://cdn.example/photo.jpg",
      },
      {
        fetchMedia: async () => ({
          bytes: new Uint8Array([1, 2, 3]),
          contentType: "image/jpeg",
          byteLength: 3,
        }),
        runC2paTrust: async () => {
          throw new NoManifestError("c2patool reported no C2PA manifest");
        },
        recoverSoftBindingManifest,
        softBindingResolvers: [{ name: "trustmark", endpoint: "https://resolver.example", lookup: "byContent", maxResults: 3 }],
        validatorVersion: "test-version",
        trustAnchorsUrl: "https://trust.example/ca.pem",
        tsaTrustAnchorsUrl: "https://trust.example/tsa.pem",
      },
    );

    expect(recoverSoftBindingManifest).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaUrl: "https://cdn.example/photo.jpg",
        contentType: "image/jpeg",
        byteLength: 3,
      }),
    );
    expect(payload).toMatchObject({
      status: "no_manifest",
      trust_status: "not_applicable",
      soft_binding: {
        status: "recovered",
        resolver_name: "trustmark",
        manifest_id: "urn:c2pa:manifest",
      },
      error_code: "soft_binding_recovered",
    });
  });

  it("does not query soft-binding resolvers for generic validator errors that mention manifests", async () => {
    const { validateJob } = await import("./validate-jobs.mjs");
    const recoverSoftBindingManifest = vi.fn();

    await expect(
      validateJob(
        {
          validation_attempt_id: 7,
          media_asset_id: 11,
          idempotency_key: "validation:11:test",
          media_url: "https://cdn.example/photo.jpg",
        },
        {
          fetchMedia: async () => ({
            bytes: new Uint8Array([1, 2, 3]),
            contentType: "image/jpeg",
            byteLength: 3,
          }),
          runC2paTrust: async () => {
            throw new Error("manifest signature mismatch");
          },
          recoverSoftBindingManifest,
          softBindingResolvers: [{ name: "trustmark", endpoint: "https://resolver.example", lookup: "byContent", maxResults: 3 }],
        },
      ),
    ).rejects.toThrow("manifest signature mismatch");

    expect(recoverSoftBindingManifest).not.toHaveBeenCalled();
  });

  it("does not query soft-binding resolvers when none are configured", async () => {
    const { NoManifestError, validateJob } = await import("./validate-jobs.mjs");
    const recoverSoftBindingManifest = vi.fn();

    await expect(
      validateJob(
        {
          validation_attempt_id: 7,
          media_asset_id: 11,
          idempotency_key: "validation:11:test",
          media_url: "https://cdn.example/photo.jpg",
        },
        {
          fetchMedia: async () => ({
            bytes: new Uint8Array([1, 2, 3]),
            contentType: "image/jpeg",
            byteLength: 3,
          }),
          runC2paTrust: async () => {
            throw new NoManifestError("c2patool reported no C2PA manifest");
          },
          recoverSoftBindingManifest,
          softBindingResolvers: [],
        },
      ),
    ).rejects.toThrow("no_manifest");

    expect(recoverSoftBindingManifest).not.toHaveBeenCalled();
  });
});
