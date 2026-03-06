"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const tokens_1 = require("../src/tokens");
(0, vitest_1.describe)("tokens utils", () => {
    (0, vitest_1.it)("creates URL-safe random refresh tokens", () => {
        const token = (0, tokens_1.newRefreshToken)();
        (0, vitest_1.expect)(token.length).toBeGreaterThan(20);
        (0, vitest_1.expect)(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });
    (0, vitest_1.it)("creates deterministic sha256 hashes", () => {
        const a = (0, tokens_1.sha256)("hello");
        const b = (0, tokens_1.sha256)("hello");
        const c = (0, tokens_1.sha256)("world");
        (0, vitest_1.expect)(a).toHaveLength(64);
        (0, vitest_1.expect)(a).toBe(b);
        (0, vitest_1.expect)(a).not.toBe(c);
    });
});
