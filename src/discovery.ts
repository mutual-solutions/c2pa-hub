export type DiscoveryInputType = "common_crawl" | "search_api" | "sitemap" | "rss" | "known_repository" | "manual_seed";

export interface DiscoveryInput {
  type: DiscoveryInputType;
  value: string;
  provider?: string;
}

export interface DiscoveryPlanItem {
  sourceType: DiscoveryInputType;
  value: string;
  provider: string;
  ordinal: number;
}

export interface DiscoveryPlan {
  releaseReady: boolean;
  missingBroadSources: DiscoveryInputType[];
  items: DiscoveryPlanItem[];
}

const REQUIRED_BROAD_SOURCES: DiscoveryInputType[] = [
  "search_api",
  "sitemap",
  "rss",
  "known_repository",
  "common_crawl",
];

export function planDiscoveryBatch(inputs: DiscoveryInput[]): DiscoveryPlan {
  const present = new Set(inputs.map((input) => input.type));
  const missingBroadSources = REQUIRED_BROAD_SOURCES.filter((source) => !present.has(source));

  return {
    releaseReady: missingBroadSources.length === 0,
    missingBroadSources,
    items: inputs.map((input, ordinal) => ({
      sourceType: input.type,
      value: input.value,
      provider: input.provider ?? input.type,
      ordinal,
    })),
  };
}
