"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcrypt_1 = __importDefault(require("bcrypt"));
const supertest_1 = __importDefault(require("supertest"));
const vitest_1 = require("vitest");
const tokens_1 = require("../src/tokens");
const hoisted = vitest_1.vi.hoisted(() => {
    const state = {
        users: [],
        verificationCodes: [],
        refreshSessions: [],
        weatherHistory: [],
    };
    const reset = () => {
        state.users = [];
        state.verificationCodes = [];
        state.refreshSessions = [];
        state.weatherHistory = [];
        sendVerificationEmailMock.mockReset();
        getWeatherMock.mockReset();
        getWeatherMock.mockResolvedValue({
            location: "Austin, TX",
            temp: 27.2,
            feelsLike: 28.4,
            condition: "scattered clouds",
            icon: "03d",
            wind: 4.2,
        });
    };
    const sendVerificationEmailMock = vitest_1.vi.fn(async () => undefined);
    const getWeatherMock = vitest_1.vi.fn();
    const queryMock = vitest_1.vi.fn(async (text, values = []) => {
        const sql = text.replace(/\s+/g, " ").trim().toLowerCase();
        if (sql.startsWith("insert into users")) {
            const user = {
                id: `user-${state.users.length + 1}`,
                email: String(values[0]),
                password_hash: String(values[1]),
                token_version: 0,
                email_verified: false,
            };
            state.users.push(user);
            return { rows: [{ id: user.id, email: user.email, token_version: user.token_version, email_verified: user.email_verified }] };
        }
        if (sql.startsWith("select id, email_verified from users where email = $1")) {
            const user = state.users.find((u) => u.email === String(values[0]));
            return { rows: user ? [{ id: user.id, email_verified: user.email_verified }] : [] };
        }
        if (sql.startsWith("select id, email, password_hash, token_version, email_verified from users where email = $1")) {
            const user = state.users.find((u) => u.email === String(values[0]));
            return { rows: user ? [user] : [] };
        }
        if (sql.startsWith("select id, email, token_version from users where id = $1")) {
            const user = state.users.find((u) => u.id === String(values[0]));
            return { rows: user ? [{ id: user.id, email: user.email, token_version: user.token_version }] : [] };
        }
        if (sql.startsWith("delete from email_verification_codes")) {
            const userId = String(values[0]);
            state.verificationCodes = state.verificationCodes.filter((c) => !(c.user_id === userId && c.consumed_at === null));
            return { rows: [] };
        }
        if (sql.startsWith("insert into email_verification_codes")) {
            const row = {
                id: `code-${state.verificationCodes.length + 1}`,
                user_id: String(values[0]),
                code_hash: String(values[1]),
                expires_at: new Date(String(values[2])),
                consumed_at: null,
                created_at: new Date(),
            };
            state.verificationCodes.push(row);
            return { rows: [] };
        }
        if (sql.startsWith("select id, code_hash, expires_at, consumed_at from email_verification_codes")) {
            const userId = String(values[0]);
            const rows = state.verificationCodes
                .filter((c) => c.user_id === userId)
                .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
            return { rows: rows.slice(0, 1) };
        }
        if (sql.startsWith("update users set email_verified = true where id = $1")) {
            const user = state.users.find((u) => u.id === String(values[0]));
            if (user)
                user.email_verified = true;
            return { rows: [] };
        }
        if (sql.startsWith("update email_verification_codes set consumed_at = now() where id = $1")) {
            const code = state.verificationCodes.find((c) => c.id === String(values[0]));
            if (code)
                code.consumed_at = new Date();
            return { rows: [] };
        }
        if (sql === "begin" || sql === "commit" || sql === "rollback") {
            return { rows: [] };
        }
        if (sql.startsWith("insert into refresh_sessions")) {
            state.refreshSessions.push({
                id: `sess-${state.refreshSessions.length + 1}`,
                user_id: String(values[0]),
                refresh_token_hash: String(values[1]),
                expires_at: new Date(String(values[2])),
                revoked_at: null,
            });
            return { rows: [] };
        }
        if (sql.startsWith("insert into weather_history")) {
            const row = {
                id: `hist-${state.weatherHistory.length + 1}`,
                user_id: String(values[0]),
                result: JSON.parse(String(values[1])),
                requested_at: new Date(),
            };
            state.weatherHistory.push(row);
            return { rows: [] };
        }
        if (sql.includes("from weather_history where user_id = $1 order by requested_at desc")) {
            const userId = String(values[0]);
            const rows = state.weatherHistory
                .filter((h) => h.user_id === userId)
                .sort((a, b) => b.requested_at.getTime() - a.requested_at.getTime());
            return { rows };
        }
        if (sql.startsWith("select id, user_id, expires_at, revoked_at from refresh_sessions where refresh_token_hash = $1")) {
            const session = state.refreshSessions.find((s) => s.refresh_token_hash === String(values[0]));
            return { rows: session ? [session] : [] };
        }
        if (sql.startsWith("update refresh_sessions set revoked_at = now() where refresh_token_hash = $1")) {
            const session = state.refreshSessions.find((s) => s.refresh_token_hash === String(values[0]));
            if (session)
                session.revoked_at = new Date();
            return { rows: [] };
        }
        throw new Error(`Unhandled SQL in test mock: ${sql}`);
    });
    return { queryMock, sendVerificationEmailMock, getWeatherMock, reset, state };
});
vitest_1.vi.mock("../src/db", () => ({
    pool: { query: hoisted.queryMock },
}));
vitest_1.vi.mock("../src/services/verificationEmail", () => ({
    sendVerificationEmail: hoisted.sendVerificationEmailMock,
}));
vitest_1.vi.mock("../src/services/weatherApi", () => {
    return {
        WeatherApi: class {
            constructor() {
                this.getWeather = hoisted.getWeatherMock;
            }
        },
    };
});
// Import after mocks
const index_1 = require("../src/index");
(0, vitest_1.describe)("Auth + weather API (e2e-style)", () => {
    (0, vitest_1.beforeEach)(() => {
        hoisted.reset();
    });
    (0, vitest_1.it)("completes register -> verify -> login and accesses weather + history", async () => {
        const registerRes = await (0, supertest_1.default)(index_1.app)
            .post("/auth/register")
            .send({ email: "user@example.com", password: "Password1" });
        (0, vitest_1.expect)(registerRes.status).toBe(201);
        (0, vitest_1.expect)(hoisted.sendVerificationEmailMock).toHaveBeenCalledTimes(1);
        const verificationCode = hoisted.sendVerificationEmailMock.mock.calls[0]?.[1];
        (0, vitest_1.expect)(verificationCode).toMatch(/^\d{6}$/);
        const loginBlocked = await (0, supertest_1.default)(index_1.app)
            .post("/auth/login")
            .send({ email: "user@example.com", password: "Password1" });
        (0, vitest_1.expect)(loginBlocked.status).toBe(403);
        const verifyRes = await (0, supertest_1.default)(index_1.app)
            .post("/auth/verify-email")
            .send({ email: "user@example.com", code: verificationCode });
        (0, vitest_1.expect)(verifyRes.status).toBe(200);
        const loginRes = await (0, supertest_1.default)(index_1.app)
            .post("/auth/login")
            .send({ email: "user@example.com", password: "Password1" });
        (0, vitest_1.expect)(loginRes.status).toBe(200);
        (0, vitest_1.expect)(typeof loginRes.body.accessToken).toBe("string");
        const weatherRes = await (0, supertest_1.default)(index_1.app)
            .get("/api/weather?city=Austin&state=TX&units=metric")
            .set("Authorization", `Bearer ${loginRes.body.accessToken}`);
        (0, vitest_1.expect)(weatherRes.status).toBe(200);
        (0, vitest_1.expect)(weatherRes.body.location).toBe("Austin, TX");
        (0, vitest_1.expect)(hoisted.getWeatherMock).toHaveBeenCalledWith(vitest_1.expect.any(String), "Austin", "TX", "metric");
        const historyRes = await (0, supertest_1.default)(index_1.app)
            .get("/api/weather/history")
            .set("Authorization", `Bearer ${loginRes.body.accessToken}`);
        (0, vitest_1.expect)(historyRes.status).toBe(200);
        (0, vitest_1.expect)(Array.isArray(historyRes.body)).toBe(true);
        (0, vitest_1.expect)(historyRes.body.length).toBe(1);
        (0, vitest_1.expect)(historyRes.body[0].result.location).toBe("Austin, TX");
    });
    (0, vitest_1.it)("rejects invalid verification code", async () => {
        await (0, supertest_1.default)(index_1.app)
            .post("/auth/register")
            .send({ email: "user@example.com", password: "Password1" });
        const res = await (0, supertest_1.default)(index_1.app)
            .post("/auth/verify-email")
            .send({ email: "user@example.com", code: "000000" });
        (0, vitest_1.expect)(res.status).toBe(400);
        (0, vitest_1.expect)(res.body.error).toMatch(/invalid verification code/i);
    });
    (0, vitest_1.it)("enforces auth and query validation on /api/weather", async () => {
        const unauthorized = await (0, supertest_1.default)(index_1.app).get("/api/weather?city=Austin&state=TX&units=metric");
        (0, vitest_1.expect)(unauthorized.status).toBe(401);
        const passwordHash = await bcrypt_1.default.hash("Password1", 4);
        hoisted.state.users.push({
            id: "user-99",
            email: "verified@example.com",
            password_hash: passwordHash,
            token_version: 0,
            email_verified: true,
        });
        const loginRes = await (0, supertest_1.default)(index_1.app)
            .post("/auth/login")
            .send({ email: "verified@example.com", password: "Password1" });
        const badState = await (0, supertest_1.default)(index_1.app)
            .get("/api/weather?city=Austin&state=TEX&units=metric")
            .set("Authorization", `Bearer ${loginRes.body.accessToken}`);
        (0, vitest_1.expect)(badState.status).toBe(400);
        (0, vitest_1.expect)(String(badState.body.error).toLowerCase()).toContain("2-letter");
    });
    (0, vitest_1.it)("stores hashed verification code only", async () => {
        await (0, supertest_1.default)(index_1.app)
            .post("/auth/register")
            .send({ email: "hashcheck@example.com", password: "Password1" });
        const sentCode = hoisted.sendVerificationEmailMock.mock.calls[0]?.[1];
        const stored = hoisted.state.verificationCodes[0];
        (0, vitest_1.expect)(stored).toBeTruthy();
        (0, vitest_1.expect)(stored.code_hash).toBe((0, tokens_1.sha256)(sentCode));
        (0, vitest_1.expect)(stored.code_hash).not.toBe(sentCode);
    });
});
