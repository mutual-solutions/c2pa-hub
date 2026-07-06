import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor, parseAssetQuery, serializeCsv } from "./export";

describe("export helpers", () => {
  it("encodes and decodes a stable validated_at/media_asset_id cursor", () => {
    const cursor = encodeCursor({ validatedAt: "2026-06-27T00:00:00.000Z", mediaAssetId: 42 });

    expect(decodeCursor(cursor)).toEqual({ ok: true, value: { validatedAt: "2026-06-27T00:00:00.000Z", mediaAssetId: 42 } });
    expect(decodeCursor("not-base64")).toEqual({ ok: false, reason: "invalid_cursor" });
  });

  it("defaults and clamps limits while preserving public category filters", () => {
    expect(parseAssetQuery(new URL("https://example.com/api/assets"))).toMatchObject({
      ok: true,
      query: { limit: 100, limitClamped: false, includeExcludedAi: false, includeDiagnostics: false },
    });
    expect(parseAssetQuery(new URL("https://example.com/api/assets?limit=5000&category=edited"))).toMatchObject({
      ok: true,
      query: { limit: 1000, limitClamped: true, category: "edited" },
    });
    expect(parseAssetQuery(new URL("https://example.com/api/assets?include_diagnostics=true"))).toMatchObject({
      ok: true,
      query: { includeDiagnostics: true },
    });
    expect(parseAssetQuery(new URL("https://example.com/api/assets?q=Proofmode&category=real"))).toMatchObject({
      ok: true,
      query: { q: "Proofmode", category: "real" },
    });
  });

  it("escapes CSV values, including formula-like cells", () => {
    const csv = serializeCsv([
      { url: "https://example.com/a,b.jpg", signer: "\"Camera\"", note: "=cmd|x" },
    ]);

    expect(csv).toContain('"https://example.com/a,b.jpg"');
    expect(csv).toContain('"""Camera"""');
    expect(csv).toContain("'=cmd|x");
  });
});
