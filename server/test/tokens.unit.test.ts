import { describe, expect, it } from "vitest";
import { newRefreshToken, sha256 } from "../src/tokens";

describe("tokens utils", () => {
  it("creates URL-safe random refresh tokens", () => {
    const token = newRefreshToken();
    expect(token.length).toBeGreaterThan(20);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("creates deterministic sha256 hashes", () => {
    const a = sha256("hello");
    const b = sha256("hello");
    const c = sha256("world");

    expect(a).toHaveLength(64);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
