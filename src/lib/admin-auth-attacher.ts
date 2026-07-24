import { createMiddleware } from "@tanstack/react-start";

const ADMIN_TOKEN_STORAGE_KEY = "mn-dhs-admin-token";

export function saveAdminAccessToken(token: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
}

export function clearAdminAccessToken() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
}

export const attachAdminAccessToken = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const token = typeof window === "undefined" ? null : window.sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
  return next({
    headers: token ? { "X-Admin-Access": token } : {},
  });
});