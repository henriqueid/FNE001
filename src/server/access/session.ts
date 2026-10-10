import { type DecisionDatabase } from "@/src/server/decisions/repository";
import { createSession, principalForSession } from "./repository";

export const SESSION_COOKIE = "strato_session";
const SESSION_HOURS = 8;

const bytesToHex = (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");

export async function hashSessionToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return bytesToHex(new Uint8Array(digest));
}

export function cookieValue(headers: Headers, name: string) {
  const cookie = headers.get("cookie") ?? "";
  return cookie
    .split(";")
    .map(part => part.trim())
    .find(part => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export async function createDemoSession(db: DecisionDatabase) {
  const token = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
  const tokenHash = await hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();
  await createSession(db, "user-henrique-admin", tokenHash, expiresAt);
  return { token, expiresAt };
}

export async function sessionPrincipal(db: DecisionDatabase, headers: Headers, tenantId: string) {
  const token = cookieValue(headers, SESSION_COOKIE);
  if (!token) return null;
  return principalForSession(db, await hashSessionToken(token), tenantId);
}

export function sessionCookie(token: string, expiresAt: string, secure: boolean) {
  return [
    `${SESSION_COOKIE}=${token}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Strict",
    `Expires=${new Date(expiresAt).toUTCString()}`,
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}
