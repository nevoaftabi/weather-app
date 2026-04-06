import crypto from "crypto";

export function newRefreshToken(): string {
  return crypto.randomBytes(48).toString("base64url");
}

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}
