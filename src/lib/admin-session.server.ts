import { deleteCookie, getCookie, getRequestHeader, setCookie } from "@tanstack/react-start/server";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type AdminSession = { unlocked?: boolean };

const SESSION_NAME = "mn-dhs-admin";
const MAX_AGE = 60 * 60 * 8;

function sessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET not set");
  return secret;
}

function cookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: (isProduction ? "none" : "lax") as "none" | "lax",
    path: "/",
    maxAge: MAX_AGE,
  };
}

function serializeAdminCookie(value: string, maxAge: number) {
  const options = cookieOptions();
  const parts = [
    `${SESSION_NAME}=${value}`,
    `Max-Age=${maxAge}`,
    `Path=${options.path}`,
    `SameSite=${options.sameSite}`,
    "HttpOnly",
  ];

  if (options.secure) parts.push("Secure");
  if (maxAge <= 0) parts.push("Expires=Thu, 01 Jan 1970 00:00:00 GMT");

  return parts.join("; ");
}

function sign(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload, "utf8").digest("base64url");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function createAdminToken() {
  const expiresAt = Date.now() + MAX_AGE * 1000;
  const payload = `unlocked:${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

export function createAdminAccessToken() {
  return createAdminToken();
}

export function adminAccessTokenIsValid(token?: string | null) {
  return tokenIsValid(token ?? undefined);
}

export function createAdminUnlockCookieHeader(token = createAdminToken()) {
  return serializeAdminCookie(token, MAX_AGE);
}

export function createAdminClearCookieHeader() {
  return serializeAdminCookie("", 0);
}

function tokenIsValid(token?: string) {
  if (!token) return false;
  const separator = token.lastIndexOf(".");
  if (separator === -1) return false;

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!payload.startsWith("unlocked:")) return false;
  if (!safeEqual(signature, sign(payload))) return false;

  const expiresAt = Number(payload.slice("unlocked:".length));
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

export function passwordMatches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export async function getAdminSession() {
  return {
    data: { unlocked: tokenIsValid(getCookie(SESSION_NAME)) || adminAccessTokenIsValid(getRequestHeader("x-admin-access")) },
    async update(data: AdminSession) {
      if (data.unlocked) {
        setCookie(SESSION_NAME, createAdminToken(), cookieOptions());
      } else {
        deleteCookie(SESSION_NAME, { path: "/" });
      }
    },
    async clear() {
      deleteCookie(SESSION_NAME, { path: "/" });
    },
  };
}

export async function requireAdmin() {
  const session = await getAdminSession();
  if (!session.data.unlocked) {
    throw new Error("Not authorized");
  }
  return session;
}