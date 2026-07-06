import { describe, expect, it } from "vitest";
import { extractCandidateMediaUrls, extractLinkedInC2paClaims, extractMediaCandidates, isLikelyMediaUrl } from "./crawl";

describe("extractCandidateMediaUrls", () => {
  it("extracts media candidates from images, srcsets, videos, links, and social meta tags", () => {
    const html = `
      <html>
        <head>
          <meta property="og:image" content="/og/photo.jpg">
          <meta name="twitter:image" content="https://cdn.example.net/card.webp">
          <link rel="image_src" href="/legacy.png">
        </head>
        <body>
          <img src="/images/a.jpg" srcset="/images/a-small.jpg 480w, /images/a-large.jpg 960w">
          <source srcset="/picture/next.avif 1x, /picture/next@2x.avif 2x">
          <video src="/video/clip.mp4" poster="/video/poster.jpg"></video>
          <a href="/downloads/original.jpeg?download=1">original</a>
          <a href="/about">not media</a>
        </body>
      </html>`;

    const urls = extractCandidateMediaUrls(html, "https://example.com/story/index.html");

    expect(urls).toEqual([
      "https://example.com/og/photo.jpg",
      "https://cdn.example.net/card.webp",
      "https://example.com/legacy.png",
      "https://example.com/images/a.jpg",
      "https://example.com/images/a-small.jpg",
      "https://example.com/images/a-large.jpg",
      "https://example.com/picture/next.avif",
      "https://example.com/picture/next@2x.avif",
      "https://example.com/video/clip.mp4",
      "https://example.com/video/poster.jpg",
      "https://example.com/downloads/original.jpeg?download=1",
    ]);
  });
});

describe("extractMediaCandidates", () => {
  it("keeps source provenance for static HTML media extraction", () => {
    const html = `
      <img src="/photo.jpg" srcset="/photo-small.jpg 480w, /photo-large.jpg 960w">
      <video poster="/poster.jpg"></video>
    `;

    const candidates = extractMediaCandidates(html, "https://example.com/post");

    expect(candidates).toEqual([
      {
        url: "https://example.com/photo.jpg",
        sourceType: "html",
        sourceUrl: "https://example.com/post",
        attribute: "src",
        ordinal: 0,
      },
      {
        url: "https://example.com/photo-small.jpg",
        sourceType: "html",
        sourceUrl: "https://example.com/post",
        attribute: "srcset",
        ordinal: 1,
      },
      {
        url: "https://example.com/photo-large.jpg",
        sourceType: "html",
        sourceUrl: "https://example.com/post",
        attribute: "srcset",
        ordinal: 2,
      },
      {
        url: "https://example.com/poster.jpg",
        sourceType: "html",
        sourceUrl: "https://example.com/post",
        attribute: "poster",
        ordinal: 3,
      },
    ]);
  });

  it("canonicalizes expiring GitHub private image URLs to stable attachment URLs", () => {
    const candidates = extractMediaCandidates(
      `<img src="https://private-user-images.githubusercontent.com/12177054/508789778-0cdcaa29-fdc2-421f-947f-d60f935e127f.jpg?jwt=temporary">`,
      "https://github.com/contentauth/c2pa-rs/issues/1555",
    );

    expect(candidates).toEqual([
      {
        url: "https://github.com/user-attachments/assets/0cdcaa29-fdc2-421f-947f-d60f935e127f",
        sourceType: "html",
        sourceUrl: "https://github.com/contentauth/c2pa-rs/issues/1555",
        attribute: "src",
        ordinal: 0,
      },
    ]);
  });
});

describe("extractLinkedInC2paClaims", () => {
  it("extracts LinkedIn public C2PA badge summaries and binds them to nearby media", () => {
    const html = `
      <ul data-test-id="feed-images-content">
        <li data-test-id="feed-images-content__list-item">
          <img
            alt="Adam's image projected on a classroom screen."
            src="https://media.licdn.com/dms/image/v2/D5622AQEpStyoPJcF_w/feedshare-shrink_800/B56Z31Hkl0K0Ac-/0/1777933897064?e=2147483647&amp;v=beta&amp;t=token">
          <button
            class="c2pa-button flex items-center"
            data-feed-action-type="viewContentCredentials"
            data-app="App or device used: Google C2PA SDK for Android"
            data-issued-by="Content Credentials issued by: Google LLC"
            data-issued-at="Content Credentials issue date: May 1, 2026">
            <span><label>View C2PA information</label></span>
          </button>
        </li>
      </ul>
    `;

    expect(extractLinkedInC2paClaims(html, "https://www.linkedin.com/feed/update/urn:li:activity:7457195260054540288/")).toEqual([
      {
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
      },
    ]);
  });
});

describe("isLikelyMediaUrl", () => {
  it("recognizes common image, video, and document URLs even with query strings", () => {
    expect(isLikelyMediaUrl("https://example.com/photo.jpg?width=1200")).toBe(true);
    expect(isLikelyMediaUrl("https://example.com/video.mov")).toBe(true);
    expect(isLikelyMediaUrl("https://example.com/report.pdf#page=1")).toBe(true);
    expect(isLikelyMediaUrl("https://github.com/user-attachments/assets/0cdcaa29-fdc2-421f-947f-d60f935e127f")).toBe(true);
    expect(isLikelyMediaUrl("https://example.com/story")).toBe(false);
  });

  it("recognizes extensionless public media endpoints from platforms that preserve original bytes", () => {
    expect(isLikelyMediaUrl("https://fotoforensics.com/analysis.php?id=8204a32ac89368dccb181692c0ed8ea9cc7cb6be.1490652&fmt=orig")).toBe(true);
    expect(isLikelyMediaUrl("https://media.licdn.com/dms/image/v2/D5622AQEpStyoPJcF_w/feedshare-shrink_800/B56Z31Hkl0K0Ac-/0/1777933897064?e=2147483647&v=beta&t=token")).toBe(true);
    expect(isLikelyMediaUrl("https://dms.licdn.com/playlist/vid/v2/D4E05AQF2crXQutFZgQ/mp4-720p-30fp-crf28/B4EZ634LiJJsB8-/0/1781201427257?e=2147483647&v=beta&t=token")).toBe(true);
  });
});
