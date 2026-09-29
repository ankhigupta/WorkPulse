import type { CookieOptions, Request, Response } from "express";
import { env } from "../../common/config/env";

export const REFRESH_COOKIE_NAME = "workpulse_refresh_token";

// Header the web client sets on login/signup to ask for cookie-based
// session handling. Its absence is what keeps every existing mobile
// request on the original JSON-body behavior — mobile never sends it, so
// mobile never receives a cookie and always gets refreshToken in the body.
const WEB_CLIENT_HEADER = "x-workpulse-client";
const WEB_CLIENT_VALUE = "web";

export function isWebClient(req: Request): boolean {
  return req.get(WEB_CLIENT_HEADER)?.toLowerCase() === WEB_CLIENT_VALUE;
}

export function readRefreshCookie(req: Request): string | undefined {
  const value = req.cookies?.[REFRESH_COOKIE_NAME];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

// Path-scoped to /api/auth so the browser only ever attaches it to the two
// endpoints that consume it (refresh, logout) — it is never sent alongside
// ordinary API calls, which authenticate with a Bearer access token instead.
function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.REFRESH_COOKIE_SECURE,
    sameSite: env.REFRESH_COOKIE_SAMESITE,
    path: "/api/auth",
    ...(env.REFRESH_COOKIE_DOMAIN ? { domain: env.REFRESH_COOKIE_DOMAIN } : {}),
  };
}

export function setRefreshCookie(res: Response, rawToken: string): void {
  res.cookie(REFRESH_COOKIE_NAME, rawToken, {
    ...cookieOptions(),
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function clearRefreshCookie(res: Response): void {
  // Same attributes minus maxAge — a browser only removes a cookie when
  // the clearing response matches the original path/domain/sameSite.
  res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions());
}
