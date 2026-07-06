import { describe, expect, it } from "vitest";
import { evaluateRobotsTxt, robotsUrlFor } from "./robots";

describe("robotsUrlFor", () => {
  it("builds a robots URL on the target origin", () => {
    expect(robotsUrlFor(new URL("https://example.com/news/photo.jpg?x=1"))).toBe("https://example.com/robots.txt");
  });
});

describe("evaluateRobotsTxt", () => {
  it("honors explicit disallow rules for the crawler user agent", () => {
    const txt = `
      User-agent: mutual-c2pa-hub
      Disallow: /private/

      User-agent: *
      Allow: /
    `;

    expect(evaluateRobotsTxt(txt, "/private/photo.jpg", "mutual-c2pa-hub/0.2").allowed).toBe(false);
    expect(evaluateRobotsTxt(txt, "/public/photo.jpg", "mutual-c2pa-hub/0.2").allowed).toBe(true);
  });

  it("lets a longer allow rule override a shorter disallow rule", () => {
    const txt = `
      User-agent: *
      Disallow: /media/
      Allow: /media/public/
    `;

    expect(evaluateRobotsTxt(txt, "/media/public/photo.jpg", "mutual-c2pa-hub/0.2")).toMatchObject({
      allowed: true,
      matchedRule: "allow: /media/public/",
    });
  });
});
