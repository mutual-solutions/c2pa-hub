import { describe, expect, it } from "vitest";
import { planDiscoveryBatch } from "./discovery";

describe("planDiscoveryBatch", () => {
  it("marks manual seed-only discovery as not release-ready", () => {
    const plan = planDiscoveryBatch([{ type: "manual_seed", value: "https://example.com/photo.jpg" }]);

    expect(plan.releaseReady).toBe(false);
    expect(plan.missingBroadSources).toContain("search_api");
  });

  it("keeps source provenance for broad discovery inputs", () => {
    const plan = planDiscoveryBatch([
      { type: "search_api", value: "Content Credentials image", provider: "brave" },
      { type: "sitemap", value: "https://example.com/sitemap.xml" },
      { type: "rss", value: "https://example.com/feed.xml" },
      { type: "known_repository", value: "https://gitlab.com/guardianproject/proofmode/proofmode-c2pa-sample-media" },
      { type: "common_crawl", value: "url-index:content-credentials" },
    ]);

    expect(plan.releaseReady).toBe(true);
    expect(plan.items.map((item) => item.sourceType)).toEqual([
      "search_api",
      "sitemap",
      "rss",
      "known_repository",
      "common_crawl",
    ]);
    expect(plan.items[0]).toMatchObject({ provider: "brave", value: "Content Credentials image" });
  });
});
