let accessToken: string | null = null;

export function getAccessToken() {
  return accessToken;
}

export function isAdminUser(): boolean {
  const claims = getTokenClaims();
  return claims?.role === "admin" || claims?.role === "root";
}

type TokenClaims = {
  sub: string;
  role: string;
  email: string;
};
export function getTokenClaims(): TokenClaims | null {
  const token = getAccessToken();
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const payload = parts[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(base64)) as Partial<TokenClaims>;

    if (
      typeof json.sub !== "string" ||
      typeof json.role !== "string" ||
      typeof json.email !== "string"
    ) {
      return null;
    }

    return { sub: json.sub, role: json.role, email: json.email };
  } catch {
    return null;
  }
}

export function isRootUser(): boolean {
  return getTokenClaims()?.role === 'root';
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getCurrentUserId() {

  return getTokenClaims()?.sub ?? null;
}
