import { describe, expect, it } from "vitest";
import { VALIDATOR_USER_AGENT } from "./http-policy.mjs";

describe("validator HTTP policy", () => {
  it("uses a browser-compatible user agent for origins that block CLI-style clients", () => {
    expect(VALIDATOR_USER_AGENT).toMatch(/^Mozilla\/5\.0 /);
    expect(VALIDATOR_USER_AGENT).toContain("mutual-c2pa-validator");
  });
});
