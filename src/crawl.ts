const MEDIA_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "avif",
  "gif",
  "heic",
  "heif",
  "tif",
  "tiff",
  "mp4",
  "mov",
  "m4v",
  "webm",
  "pdf",
] as const;

const URL_ATTRS = ["src", "href", "poster", "content"] as const;
const SOURCE_ORDER_ATTRS = ["srcset", ...URL_ATTRS] as const;

export type DiscoverySourceType =
  | "common_crawl"
  | "search_api"
  | "sitemap"
  | "rss"
  | "known_repository"
  | "manual_seed"
  | "direct_media"
  | "linkedin_public_post"
  | "html";

export interface MediaCandidate {
  url: string;
  sourceType: DiscoverySourceType;
  sourceUrl: string;
  attribute: string;
  ordinal: number;
}

export type PlatformCategoryHint = "real" | "edited" | "excluded_ai_generated" | "diagnostic";

export interface LinkedInC2paClaim {
  platform: "linkedin";
  platformClaimSource: "linkedin_public_c2pa_badge";
  postUrl: string;
  mediaUrl: string | null;
  app: string | null;
  issuedBy: string | null;
  issuedAt: string | null;
  aiDisclosure: string | null;
  categoryHint: PlatformCategoryHint;
  ordinal: number;
}

export interface CrawlInput {
  seedUrl: string;
  limit: number;
}

export function extractCandidateMediaUrls(html: string, baseUrl: string): string[] {
  return extractMediaCandidates(html, baseUrl).map((candidate) => candidate.url);
}

export function extractMediaCandidates(html: string, baseUrl: string, sourceType: DiscoverySourceType = "html"): MediaCandidate[] {
  const candidates: MediaCandidate[] = [];
  const seen = new Set<string>();
  const attrPattern = new RegExp(`\\b(${SOURCE_ORDER_ATTRS.join("|")})\\s*=\\s*["']([^"']+)["']`, "gi");

  for (const match of html.matchAll(attrPattern)) {
    const attribute = match[1].toLowerCase();
    const rawValue = decodeHtmlAttribute(match[2]);
    const values = attribute === "srcset" ? parseSrcset(rawValue) : [rawValue];
    for (const value of values) {
      const normalized = normalizeMediaUrl(value, baseUrl);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      candidates.push({
        url: normalized,
        sourceType,
        sourceUrl: new URL(baseUrl).toString(),
        attribute,
        ordinal: candidates.length,
      });
    }
  }

  return candidates;
}

export function extractLinkedInC2paClaims(html: string, baseUrl: string): LinkedInC2paClaim[] {
  const postUrl = new URL(baseUrl).toString();
  const claims: LinkedInC2paClaim[] = [];

  for (const match of html.matchAll(/<button\b[^>]*>/gi)) {
    const tag = match[0];
    const attrs = parseHtmlAttributes(tag);
    if (!attrs.class?.split(/\s+/).includes("c2pa-button")) continue;
    if (attrs["data-feed-action-type"] !== "viewContentCredentials") continue;

    const app = stripKnownPrefix(attrs["data-app"], ["App or device used:"]);
    const issuedBy = stripKnownPrefix(attrs["data-issued-by"], ["Content Credentials issued by:"]);
    const issuedAt = stripKnownPrefix(attrs["data-issued-at"], ["Content Credentials issue date:"]);
    const aiDisclosure = attrs["data-ai"] ?? null;

    claims.push({
      platform: "linkedin",
      platformClaimSource: "linkedin_public_c2pa_badge",
      postUrl,
      mediaUrl: nearestLinkedInMediaUrl(html, match.index ?? 0, baseUrl),
      app,
      issuedBy,
      issuedAt,
      aiDisclosure,
      categoryHint: inferLinkedInCategoryHint(app, aiDisclosure),
      ordinal: claims.length,
    });
  }

  return claims;
}

export function parseCrawlInput(body: unknown): CrawlInput | null {
  if (!body || typeof body !== "object") return null;

  const rawSeed = "url" in body ? (body as { url: unknown }).url : (body as { seedUrl?: unknown }).seedUrl;
  if (typeof rawSeed !== "string") return null;

  const seedUrl = parseHttpUrl(rawSeed);
  if (!seedUrl) return null;

  const requestedLimit = Number((body as { limit?: unknown }).limit ?? 20);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(50, Math.trunc(requestedLimit))) : 20;

  return { seedUrl: seedUrl.toString(), limit };
}

export function isLikelyMediaUrl(value: string): boolean {
  if (isGitHubUserAttachmentUrl(value)) return true;

  let pathname: string;
  try {
    const url = new URL(value);
    if (isKnownExtensionlessMediaUrl(url)) return true;
    pathname = url.pathname.toLowerCase();
  } catch {
    pathname = value.toLowerCase().split(/[?#]/, 1)[0];
  }

  return MEDIA_EXTENSIONS.some((extension) => pathname.endsWith(`.${extension}`));
}

function isGitHubUserAttachmentUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.hostname === "github.com" && /^\/user-attachments\/assets\/[0-9a-f-]{32,}$/i.test(url.pathname);
  } catch {
    return false;
  }
}

function isKnownExtensionlessMediaUrl(url: URL): boolean {
  if (url.hostname === "fotoforensics.com" && url.pathname === "/analysis.php" && url.searchParams.get("fmt") === "orig") {
    return true;
  }

  if (url.hostname === "media.licdn.com" && url.pathname.startsWith("/dms/image/")) {
    return true;
  }

  if (url.hostname === "dms.licdn.com" && url.pathname.startsWith("/playlist/vid/")) {
    return true;
  }

  return false;
}

export function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

function parseSrcset(value: string): string[] {
  return value
    .split(",")
    .map((candidate) => candidate.trim().split(/\s+/, 1)[0])
    .filter(Boolean);
}

function parseHtmlAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of tag.matchAll(/\s([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    attrs[match[1].toLowerCase()] = decodeHtmlAttribute(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attrs;
}

function nearestLinkedInMediaUrl(html: string, offset: number, baseUrl: string): string | null {
  const before = html.slice(Math.max(0, offset - 8_000), offset);
  const beforeUrls = extractLinkedInMediaUrls(before, baseUrl);
  if (beforeUrls.length) return beforeUrls.at(-1) ?? null;

  const after = html.slice(offset, Math.min(html.length, offset + 8_000));
  const afterUrls = extractLinkedInMediaUrls(after, baseUrl);
  return afterUrls[0] ?? null;
}

function extractLinkedInMediaUrls(html: string, baseUrl: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  const attrPattern = new RegExp(`\\b(${SOURCE_ORDER_ATTRS.join("|")})\\s*=\\s*["']([^"']+)["']`, "gi");

  for (const match of html.matchAll(attrPattern)) {
    const attribute = match[1].toLowerCase();
    const rawValue = decodeHtmlAttribute(match[2]);
    const values = attribute === "srcset" ? parseSrcset(rawValue) : [rawValue];
    for (const value of values) {
      const normalized = normalizeMediaUrl(value, baseUrl);
      if (!normalized || seen.has(normalized) || !isLinkedInContentMediaUrl(normalized)) continue;
      seen.add(normalized);
      urls.push(normalized);
    }
  }

  return urls;
}

function isLinkedInContentMediaUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.hostname === "media.licdn.com" && url.pathname.startsWith("/dms/image/")) ||
      (url.hostname === "dms.licdn.com" && url.pathname.startsWith("/playlist/vid/"))
    );
  } catch {
    return false;
  }
}

function stripKnownPrefix(value: string | undefined, prefixes: string[]): string | null {
  const text = value?.trim();
  if (!text) return null;
  for (const prefix of prefixes) {
    if (text.toLowerCase().startsWith(prefix.toLowerCase())) {
      return text.slice(prefix.length).trim() || null;
    }
  }
  return text;
}

function inferLinkedInCategoryHint(app: string | null, aiDisclosure: string | null): PlatformCategoryHint {
  const normalizedApp = normalizeToken(app);
  if (aiDisclosure || /openai|dall|gemini|midjourney|flux|stability|suno/.test(normalizedApp)) return "excluded_ai_generated";
  if (/adobe|premiere|photoshop|lightroom|aftereffects|finalcut|davinci|resolve|capcut/.test(normalizedApp)) return "edited";
  if (/googlec2pasdkforandroid|pixelcamera|proofmode|camera/.test(normalizedApp)) return "real";
  return "diagnostic";
}

function normalizeToken(value: string | null | undefined): string {
  return String(value ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function candidatesFromUrls(
  urls: string[],
  sourceUrl: string,
  sourceType: DiscoverySourceType,
  attribute = "url",
): MediaCandidate[] {
  const candidates: MediaCandidate[] = [];
  const seen = new Set<string>();
  for (const value of urls) {
    const normalized = normalizeMediaUrl(value, sourceUrl);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    candidates.push({
      url: normalized,
      sourceType,
      sourceUrl,
      attribute,
      ordinal: candidates.length,
    });
  }
  return candidates;
}

function normalizeMediaUrl(value: string, baseUrl: string): string | null {
  if (!value || value.startsWith("data:") || value.startsWith("blob:")) return null;

  try {
    const url = new URL(canonicalizeGitHubAttachmentUrl(value) ?? value, baseUrl);
    if ((url.protocol === "http:" || url.protocol === "https:") && isLikelyMediaUrl(url.toString())) {
      return url.toString();
    }
  } catch {
    // Ignore malformed scraped attribute values.
  }
  return null;
}

function canonicalizeGitHubAttachmentUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const stable = url.pathname.match(/^\/user-attachments\/assets\/([0-9a-f-]{32,})$/i);
    if (url.hostname === "github.com" && stable) {
      return `https://github.com/user-attachments/assets/${stable[1]}`;
    }

    const privateImage = url.pathname.match(/^\/\d+\/\d+-([0-9a-f]{8}-[0-9a-f-]{27})(?:\.[a-z0-9]+)?$/i);
    const isGitHubPrivateImage = url.hostname === "private-user-images.githubusercontent.com" || /^github-production-user-asset-[^.]+\.s3\.amazonaws\.com$/i.test(url.hostname);
    if (isGitHubPrivateImage && privateImage) {
      return `https://github.com/user-attachments/assets/${privateImage[1]}`;
    }
  } catch {
    // Leave non-absolute scraped values to normal URL resolution.
  }
  return null;
}
