import { describe, expect, it } from "vitest";
import { classifyC2paEvidence } from "./c2pa";

const bytes = (text: string) => new TextEncoder().encode(text);

describe("classifyC2paEvidence", () => {
  it("classifies bytes with C2PA manifest markers as provenance-positive", () => {
    const result = classifyC2paEvidence(bytes("jpeg data c2pa manifest JUMBF"));

    expect(result.hasC2pa).toBe(true);
    expect(result.classification).toBe("c2pa-present");
    expect(result.markers).toContain("c2pa");
    expect(result.markers).toContain("jumbf");
  });

  it("classifies AI disclosure markers separately from camera provenance", () => {
    const result = classifyC2paEvidence(bytes("claim c2pa.ai-disclosure trainedAlgorithmicMedia"));

    expect(result.hasC2pa).toBe(true);
    expect(result.hasAiDisclosure).toBe(true);
    expect(result.classification).toBe("ai-disclosed");
  });

  it("does not call absent credentials AI", () => {
    const result = classifyC2paEvidence(bytes("ordinary image bytes"));

    expect(result.hasC2pa).toBe(false);
    expect(result.classification).toBe("unknown");
    expect(result.warning).toMatch(/absence/i);
  });
});
