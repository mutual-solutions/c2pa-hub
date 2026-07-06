import { describe, expect, it } from "vitest";
import { isPublicSearchCategory, normalizeValidation } from "./taxonomy";

describe("normalizeValidation", () => {
  it("maps trusted direct digital capture to the public real category", () => {
    const result = normalizeValidation({
      manifestPresent: true,
      signatureTrusted: true,
      validationStatus: "valid",
      digitalSourceType: "digitalCapture",
      actions: ["c2pa.created"],
      ingredientsCount: 0,
      aiDisclosurePresent: false,
    });

    expect(result.classification).toBe("trusted_camera_capture");
    expect(result.publicCategory).toBe("real");
    expect(isPublicSearchCategory(result.publicCategory)).toBe(true);
  });

  it("maps trusted computational capture to the public real category", () => {
    const result = normalizeValidation({
      manifestPresent: true,
      signatureTrusted: true,
      validationStatus: "valid",
      digitalSourceType: "http://cv.iptc.org/newscodes/digitalsourcetype/computationalCapture",
      actions: ["c2pa.created"],
      ingredientsCount: 0,
      aiDisclosurePresent: false,
    });

    expect(result.classification).toBe("trusted_camera_capture");
    expect(result.publicCategory).toBe("real");
    expect(isPublicSearchCategory(result.publicCategory)).toBe(true);
  });

  it("maps valid camera-origin assets with later edits to the edited category", () => {
    const result = normalizeValidation({
      manifestPresent: true,
      signatureTrusted: true,
      validationStatus: "valid",
      digitalSourceType: "digitalCapture",
      actions: ["c2pa.created", "c2pa.edited", "c2pa.placed"],
      ingredientsCount: 1,
      aiDisclosurePresent: false,
    });

    expect(result.classification).toBe("trusted_edited");
    expect(result.publicCategory).toBe("edited");
    expect(isPublicSearchCategory(result.publicCategory)).toBe(true);
  });

  it("maps trusted non-generative digital source edit terms to the edited category", () => {
    for (const digitalSourceType of [
      "http://cv.iptc.org/newscodes/digitalsourcetype/humanEdits",
      "http://cv.iptc.org/newscodes/digitalsourcetype/algorithmicallyEnhanced",
    ]) {
      const result = normalizeValidation({
        manifestPresent: true,
        signatureTrusted: true,
        validationStatus: "valid",
        digitalSourceType,
        actions: ["c2pa.opened", "c2pa.transcoded"],
        ingredientsCount: 1,
        aiDisclosurePresent: false,
      });

      expect(result.classification).toBe("trusted_edited");
      expect(result.publicCategory).toBe("edited");
      expect(isPublicSearchCategory(result.publicCategory)).toBe(true);
    }
  });

  it("excludes pure AI-generated C2PA assets from public search results", () => {
    const result = normalizeValidation({
      manifestPresent: true,
      signatureTrusted: true,
      validationStatus: "valid",
      digitalSourceType: "trainedAlgorithmicMedia",
      actions: ["c2pa.created"],
      ingredientsCount: 0,
      aiDisclosurePresent: true,
    });

    expect(result.classification).toBe("ai_disclosed");
    expect(result.publicCategory).toBe("excluded_ai_generated");
    expect(isPublicSearchCategory(result.publicCategory)).toBe(false);
  });

  it("keeps missing credentials unknown instead of calling them AI", () => {
    const result = normalizeValidation({
      manifestPresent: false,
      signatureTrusted: false,
      validationStatus: "no_manifest",
      actions: [],
      ingredientsCount: 0,
      aiDisclosurePresent: false,
    });

    expect(result.classification).toBe("stripped_or_unknown");
    expect(result.publicCategory).toBe("diagnostic");
    expect(result.warning).toMatch(/not evidence/i);
  });

  it("keeps soft-binding recovered manifests diagnostic until separately validated", () => {
    const result = normalizeValidation({
      manifestPresent: false,
      signatureTrusted: false,
      validationStatus: "no_manifest",
      actions: [],
      ingredientsCount: 0,
      aiDisclosurePresent: false,
      softBindingRecovered: true,
    });

    expect(result.classification).toBe("soft_binding_recovered");
    expect(result.publicCategory).toBe("diagnostic");
    expect(isPublicSearchCategory(result.publicCategory)).toBe(false);
  });
});
