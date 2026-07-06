import { describe, expect, it } from "vitest";
import { validatePublicHttpUrl } from "./safety";

describe("validatePublicHttpUrl", () => {
  it("accepts ordinary public HTTP(S) URLs and normalizes them", () => {
    const result = validatePublicHttpUrl("https://Example.com/a photo.jpg?x=1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.url.toString()).toBe("https://example.com/a%20photo.jpg?x=1");
    }
  });

  it("rejects unsafe protocols, credentials, local hosts, and private or reserved addresses", () => {
    expect(validatePublicHttpUrl("file:///tmp/a.jpg")).toMatchObject({ ok: false, reason: "unsupported_protocol" });
    expect(validatePublicHttpUrl("https://user:pass@example.com/a.jpg")).toMatchObject({
      ok: false,
      reason: "credentials_not_allowed",
    });
    expect(validatePublicHttpUrl("https://localhost/a.jpg")).toMatchObject({ ok: false, reason: "reserved_host" });
    expect(validatePublicHttpUrl("https://camera.local/a.jpg")).toMatchObject({ ok: false, reason: "reserved_host" });
    expect(validatePublicHttpUrl("https://127.0.0.1/a.jpg")).toMatchObject({ ok: false, reason: "reserved_ip" });
    expect(validatePublicHttpUrl("https://10.0.0.5/a.jpg")).toMatchObject({ ok: false, reason: "reserved_ip" });
    expect(validatePublicHttpUrl("https://192.0.2.10/a.jpg")).toMatchObject({ ok: false, reason: "reserved_ip" });
  });
});
