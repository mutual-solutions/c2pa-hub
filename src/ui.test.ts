import { describe, expect, it } from "vitest";

import { renderAssetsLibrary, renderHome, renderLandscape, renderMethodology, renderResources } from "./ui";

const LANDSCAPE_FIXTURE = {
  total: 437,
  domains: 38,
  firstSeen: "2026-06-27T08:24:40.093Z",
  lastSeen: "2026-07-05T00:17:55.539Z",
  classifications: [
    { classification: "stripped_or_unknown", n: 341 },
    { classification: "c2pa_present_untrusted", n: 72 },
    { classification: "c2pa_invalid", n: 10 },
    { classification: "trusted_camera_capture", n: 7 },
    { classification: "trusted_edited", n: 4 },
    { classification: "fetch_failed", n: 3 },
  ],
  signers: [
    { signer: "Pixel Camera", classification: "trusted_camera_capture", n: 5 },
    { signer: "Pixel Camera", classification: "c2pa_present_untrusted", n: 1 },
    { signer: "C2PA Signer", classification: "c2pa_present_untrusted", n: 13 },
    { signer: "C2PA Signer", classification: "c2pa_invalid", n: 7 },
  ],
};

describe("renderHome", () => {
  it("uses the mutual brand system for the search shell", () => {
    const html = renderHome();

    expect(html).toContain("https://mutual.solutions/img/logo.png");
    expect(html).toContain("--m-blue: #4a8b9c");
    expect(html).toContain("Signed at capture. Before software can touch it.");
    expect(html).toContain("class=\"app-shell\"");
  });

  it("declares page identity metadata for browsers and social cards", () => {
    const html = renderHome();

    expect(html).toContain("rel=\"icon\"");
    expect(html).toContain("data:image/svg+xml");
    expect(html).toContain("property=\"og:title\"");
    expect(html).toContain("<meta property=\"og:image\" content=\"https://c2pa.mutual.solutions/og.png\">");
    expect(html).toContain("<meta name=\"twitter:card\" content=\"summary_large_image\">");
    expect(html).toContain("<meta name=\"theme-color\" content=\"#4a8b9c\">");
    expect(html).toContain("<link rel=\"canonical\" href=\"https://c2pa.mutual.solutions/\">");
  });

  it("supports shareable URL state, detail dialog, and click-to-filter", () => {
    const html = renderHome();

    expect(html).toContain("history.replaceState");
    expect(html).toContain("restoreFromUrl");
    expect(html).toContain("new URLSearchParams(location.search)");
    expect(html).toContain("<dialog id=\"detail\"");
    expect(html).toContain("showModal");
    expect(html).toContain("aria-labelledby=\"detail-title\"");
    expect(html).toContain("class=\"value value-filter\"");
    expect(html).toContain("detail-button");
  });

  it("shows corpus stats, cursor pagination, and a shared footer", () => {
    const html = renderHome();

    expect(html).toContain("id=\"stats\"");
    expect(html).toContain("id=\"stat-real\"");
    expect(html).toContain("/api/stats");
    expect(html).toContain("id=\"load-more\"");
    expect(html).toContain("params.set(\"cursor\", state.cursor)");
    expect(html).toContain("class=\"site-footer\"");
    expect(html).toContain("MCP endpoint: POST /mcp");
  });

  it("keeps search, category filtering, results, and source submission on the first screen", () => {
    const html = renderHome();

    expect(html).toContain("id=\"query\"");
    expect(html).toContain("id=\"tab-real\"");
    expect(html).toContain("id=\"tab-edited\"");
    expect(html).toContain("id=\"results\"");
    expect(html).toContain("id=\"crawl\"");
    expect(html).toContain("Queue source");
    expect(html).toContain("fetchpriority=\"high\"");
  });

  it("renders loading skeletons, empty state, and error state hooks", () => {
    const html = renderHome();

    expect(html).toContain("renderSkeletons");
    expect(html).toContain("skel-thumb");
    expect(html).toContain("state-kicker");
    expect(html).toContain("state-error");
    expect(html).toContain("No public ' + state.category + ' results match this query yet.");
  });

  it("marks the category switcher up as accessible tabs", () => {
    const html = renderHome();

    expect(html).toContain("role=\"tablist\"");
    expect(html).toContain("role=\"tab\"");
    expect(html).toContain("aria-controls=\"results\"");
    expect(html).toContain("ArrowRight");
  });

  it("supports deep-linkable asset dialog via asset URL param", () => {
    const html = renderHome();

    expect(html).toContain("initialAssetId");
    expect(html).toContain("setAssetParam");
    expect(html).toContain("openInitialAsset");
    expect(html).toContain("/api/assets/");
    expect(html).toContain('params.set("asset"');
    expect(html).toContain('params.delete("asset")');
  });
});

describe("renderMethodology", () => {
  it("renders a dedicated brand-styled methodology page", () => {
    const html = renderMethodology();

    expect(html).toContain("How the corpus is built and classified.");
    expect(html).toContain("Public taxonomy");
    expect(html).toContain("Discovery sources");
    expect(html).toContain("Limitations");
    expect(html).toContain("--m-blue: #4a8b9c");
    expect(html).toContain("href=\"/api/methodology\"");
    expect(html).toContain("class=\"back-link\" href=\"/\"");
    expect(html).toContain("class=\"site-footer\"");
  });

  it("shows the methodology version when provided", () => {
    expect(renderMethodology("c2pa-hub-v2-test")).toContain("c2pa-hub-v2-test");
    expect(renderMethodology()).not.toContain("<span class=\"mono\">");
  });

  it("links to the landscape page from shared chrome", () => {
    expect(renderHome()).toContain("href=\"/landscape\"");
    expect(renderMethodology()).toContain("href=\"/landscape\"");
  });

  it("renders the How validation works pipeline section with four steps", () => {
    const html = renderMethodology();

    expect(html).toContain("How validation works");
    expect(html).toContain("Discover");
    expect(html).toContain("Fetch");
    expect(html).toContain("Validate");
    expect(html).toContain("Classify");
    expect(html).toContain("pipe-grid");
    expect(html).toContain("pipe-step");
  });
});

describe("renderAssetsLibrary and renderResources", () => {
  it("renders filter chips, download actions, and full-record links", () => {
    const html = renderAssetsLibrary(
      [
        { id: 7, url: "https://example.com/x.jpg", domain: "example.com", public_category: "real", classification: "trusted_camera_capture", signer: "Pixel Camera", claim_generator: "Pixel Camera", content_type: "image/jpeg", latest_validated_at: "2026-07-01T00:00:00Z", cached_object_key: "media-assets/7/original" },
        { id: 8, url: "https://example.org/y.jpg", domain: "example.org", public_category: "edited", classification: "trusted_edited", signer: "Adobe", claim_generator: "Photoshop", content_type: "image/jpeg", latest_validated_at: "2026-07-02T00:00:00Z", cached_object_key: null },
      ],
      [{ signer: "Pixel Camera", n: 5 }],
      { signer: null, category: null },
    );

    expect(html).toContain("/assets?signer=Pixel%20Camera");
    expect(html).toContain("Download original");
    expect(html).toContain("source only");
    expect(html).toContain("/?asset=7");
    expect(html).toContain("class=\"lib-chip active\"");
  });

  it("renders the resources directory with external tools linked", () => {
    const html = renderResources();

    expect(html).toContain("https://c2paviewer.com/");
    expect(html).toContain("https://verify.contentauthenticity.org/");
    expect(html).toContain("https://spec.c2pa.org/");
    expect(html).toContain("href=\"/assets\"");
    expect(html).toContain("A working directory for people building on C2PA.");
  });
});

describe("renderLandscape", () => {
  it("computes the funnel, trust gap, and hero share from classification counts", () => {
    const html = renderLandscape(LANDSCAPE_FIXTURE);

    expect(html).toContain("The provenance funnel");
    expect(html).toContain("The trust gap");
    expect(html).toContain("Why adoption is stuck");
    // trusted 11 of 437 = 2.5%
    expect(html).toContain(">2.5<sup>%</sup>");
    // manifests found = 72 + 10 + 11 = 93; fail trust = 82 -> 88%
    expect(html).toContain("88% of the manifests");
    // funnel: fetched = 437 - 3
    expect(html).toContain("434");
    // validated chart palette
    expect(html).toContain("#059669");
    expect(html).toContain("#1d89a6");
    expect(html).toContain("#2a4d59");
  });

  it("renders signer rows as searchable links with escaped names and table twin", () => {
    const html = renderLandscape(LANDSCAPE_FIXTURE);

    expect(html).toContain("/?q=Pixel%20Camera");
    expect(html).toContain("View as table");
    expect(html).toContain("land-tooltip");
    expect(html).toContain("data-tip");
  });

  it("survives an empty corpus without NaN output", () => {
    const html = renderLandscape({ total: 0, domains: 0, firstSeen: null, lastSeen: null, classifications: [], signers: [] });

    expect(html).not.toContain("NaN");
    expect(html).toContain(">0<sup>%</sup>");
  });
});
