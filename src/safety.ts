export type UrlSafetyFailureReason =
  | "invalid_url"
  | "unsupported_protocol"
  | "credentials_not_allowed"
  | "reserved_host"
  | "reserved_ip";

export type UrlSafetyResult = { ok: true; url: URL } | { ok: false; reason: UrlSafetyFailureReason };

export function validatePublicHttpUrl(value: string): UrlSafetyResult {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return { ok: false, reason: "invalid_url" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "unsupported_protocol" };
  }

  if (url.username || url.password) {
    return { ok: false, reason: "credentials_not_allowed" };
  }

  const host = url.hostname.toLowerCase();
  if (isReservedHostname(host)) {
    return { ok: false, reason: "reserved_host" };
  }

  if (isReservedIp(host)) {
    return { ok: false, reason: "reserved_ip" };
  }

  return { ok: true, url };
}

export function isReservedHostname(host: string): boolean {
  return host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local");
}

export function isReservedIp(host: string): boolean {
  const plainHost = host.replace(/^\[/, "").replace(/\]$/, "");
  if (plainHost.includes(":")) return isReservedIpv6(plainHost);
  const octets = plainHost.split(".").map((part) => Number(part));
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a, b, c, d] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224 ||
    (a === 255 && b === 255 && c === 255 && d === 255)
  );
}

function isReservedIpv6(host: string): boolean {
  const normalized = host.toLowerCase();
  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}
