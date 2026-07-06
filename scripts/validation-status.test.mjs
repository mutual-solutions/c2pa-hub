import { describe, expect, it } from "vitest";
import { isHardFailureCode } from "./validation-status.mjs";

describe("validator status classification", () => {
  it("treats malformed claims as hard validation failures", () => {
    expect(isHardFailureCode("claim.malformed")).toBe(true);
    expect(isHardFailureCode("assertion.malformed")).toBe(true);
  });

  it("does not collapse untrusted signing credentials into structural validation failures", () => {
    expect(isHardFailureCode("signingCredential.untrusted")).toBe(false);
  });
});
