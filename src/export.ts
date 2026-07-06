export interface CursorValue {
  validatedAt: string;
  mediaAssetId: number;
}

export type CursorDecodeResult = { ok: true; value: CursorValue } | { ok: false; reason: "invalid_cursor" };

export interface AssetQuery {
  limit: number;
  limitClamped: boolean;
  q?: string;
  category?: "real" | "edited";
  domain?: string;
  signer?: string;
  generator?: string;
  classification?: string;
  includeExcludedAi: boolean;
  includeDiagnostics: boolean;
  cursor?: CursorValue;
}

export type AssetQueryResult = { ok: true; query: AssetQuery } | { ok: false; reason: "invalid_cursor" };

export function encodeCursor(value: CursorValue): string {
  return base64UrlEncode(JSON.stringify(value));
}

export function decodeCursor(value: string): CursorDecodeResult {
  try {
    const decoded = JSON.parse(base64UrlDecode(value)) as Partial<CursorValue>;
    if (typeof decoded.validatedAt !== "string" || !Number.isInteger(decoded.mediaAssetId)) {
      return { ok: false, reason: "invalid_cursor" };
    }
    const mediaAssetId = decoded.mediaAssetId;
    if (mediaAssetId === undefined) return { ok: false, reason: "invalid_cursor" };
    return { ok: true, value: { validatedAt: decoded.validatedAt, mediaAssetId } };
  } catch {
    return { ok: false, reason: "invalid_cursor" };
  }
}

export function parseAssetQuery(url: URL): AssetQueryResult {
  const requestedLimit = Number(url.searchParams.get("limit") ?? "100");
  const safeLimit = Number.isFinite(requestedLimit) ? Math.trunc(requestedLimit) : 100;
  const limit = Math.max(1, Math.min(1000, safeLimit));
  const limitClamped = limit !== safeLimit;
  const category = url.searchParams.get("category") || undefined;
  const cursorParam = url.searchParams.get("cursor");
  let cursor: CursorValue | undefined;
  if (cursorParam) {
    const decoded = decodeCursor(cursorParam);
    if (!decoded.ok) return decoded;
    cursor = decoded.value;
  }

  return {
    ok: true,
    query: {
      limit,
      limitClamped,
      q: url.searchParams.get("q") || undefined,
      category: category === "real" || category === "edited" ? category : undefined,
      domain: url.searchParams.get("domain") || undefined,
      signer: url.searchParams.get("signer") || undefined,
      generator: url.searchParams.get("generator") || undefined,
      classification: url.searchParams.get("classification") || undefined,
      includeExcludedAi: url.searchParams.get("include_excluded_ai") === "true",
      includeDiagnostics: url.searchParams.get("include_diagnostics") === "true",
      cursor,
    },
  };
}

export function serializeCsv(rows: Array<Record<string, unknown>>): string {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvCell(row[header])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  if (/[",\n\r]/.test(safeText)) {
    return `"${safeText.replace(/"/g, '""')}"`;
  }
  return safeText;
}

function base64UrlEncode(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("invalid_cursor");
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return atob(padded);
}
