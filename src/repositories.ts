import { isLikelyMediaUrl } from "./crawl";

export type RepositoryFetcher = (url: string | URL, init?: RequestInit) => Promise<Response>;

const API_HEADERS = { "user-agent": "mutual-c2pa-hub/0.2 (+https://c2pa.mutual.solutions/methodology)", accept: "application/json" };
const MAX_REPOSITORY_MEDIA_URLS = 500;
const MAX_GITLAB_TREE_PAGES = 20;

export interface GitLabRepository {
  projectPath: string;
  branch: string;
}

export async function listProofmodeSampleMedia(fetcher: RepositoryFetcher = fetch): Promise<string[]> {
  return listGitLabRepositoryMediaUrls(
    {
      projectPath: "guardianproject/proofmode/proofmode-c2pa-sample-media",
      branch: "main",
    },
    fetcher,
  );
}

export async function listContentAuthExampleAssets(fetcher: RepositoryFetcher = fetch): Promise<string[]> {
  return listGitHubRepositoryMediaUrls(
    {
      owner: "contentauth",
      repo: "example-assets",
      branch: "main",
      rawBaseUrl: "https://contentauth.github.io/example-assets",
    },
    fetcher,
  );
}

export async function listContentAuthConformanceToolCliAssets(fetcher: RepositoryFetcher = fetch): Promise<string[]> {
  return listGitHubRepositoryMediaUrls(
    {
      owner: "contentauth",
      repo: "c2pa-conformance-tool-cli",
      branch: "main",
      rawBaseUrl: "https://raw.githubusercontent.com/contentauth/c2pa-conformance-tool-cli/main",
    },
    fetcher,
  );
}

export async function listC2paPublicTestImages(fetcher: RepositoryFetcher = fetch): Promise<string[]> {
  return listGitHubRepositoryMediaUrls(
    {
      owner: "c2pa-org",
      repo: "public-testfiles",
      branch: "main",
      rawBaseUrl: "https://raw.githubusercontent.com/c2pa-org/public-testfiles/main",
    },
    fetcher,
  );
}

export async function listGitLabRepositoryMediaUrls(repository: GitLabRepository, fetcher: RepositoryFetcher = fetch): Promise<string[]> {
  const urls: string[] = [];
  const seen = new Set<string>();
  let page = "1";

  for (let pagesFetched = 0; pagesFetched < MAX_GITLAB_TREE_PAGES; pagesFetched += 1) {
    const apiUrl = new URL(`https://gitlab.com/api/v4/projects/${encodeURIComponent(repository.projectPath)}/repository/tree`);
    apiUrl.searchParams.set("recursive", "true");
    apiUrl.searchParams.set("per_page", "100");
    apiUrl.searchParams.set("page", page);

    const response = await fetcher(apiUrl, { headers: API_HEADERS });
    if (!response.ok) break;

    const entries = (await response.json()) as Array<{ path?: string; type?: string }>;
    for (const entry of entries) {
      if (entry.type !== "blob" || !entry.path || !isLikelyMediaUrl(`https://example.com/${entry.path}`)) continue;
      const rawUrl = `https://gitlab.com/${encodePathSegments(repository.projectPath)}/-/raw/${encodePathSegments(repository.branch)}/${encodePathSegments(entry.path)}`;
      if (seen.has(rawUrl)) continue;
      seen.add(rawUrl);
      urls.push(rawUrl);
      if (urls.length >= MAX_REPOSITORY_MEDIA_URLS) return urls;
    }

    const nextPage = response.headers.get("x-next-page")?.trim();
    if (!nextPage) break;
    page = nextPage;
  }

  return urls;
}

interface GitHubRepository {
  owner: string;
  repo: string;
  branch: string;
  rawBaseUrl: string;
}

async function listGitHubRepositoryMediaUrls(repository: GitHubRepository, fetcher: RepositoryFetcher): Promise<string[]> {
  const response = await fetcher(`https://api.github.com/repos/${repository.owner}/${repository.repo}/git/trees/${repository.branch}?recursive=1`, {
    headers: API_HEADERS,
  });
  if (!response.ok) return [];

  const body = (await response.json()) as { tree?: Array<{ path?: string; type?: string }> };
  return (body.tree ?? [])
    .filter((entry) => entry.type === "blob" && entry.path && isLikelyMediaUrl(`https://example.com/${entry.path}`))
    .slice(0, MAX_REPOSITORY_MEDIA_URLS)
    .map((entry) => `${repository.rawBaseUrl}/${encodePathSegments(entry.path ?? "")}`);
}

function encodePathSegments(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}
