import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { ForbiddenError } from "../errors";
import { isWebClient, readRefreshCookie } from "../../modules/auth/cookies";

// CSRF defense for the only endpoints that ever authenticate from an
// ambient browser credential (the httpOnly refresh cookie).
//
// Every other API route authenticates with a Bearer access token that
// lives in memory and must be attached explicitly by application code —
// a cross-site request cannot produce one, so those routes are
// structurally CSRF-immune and need nothing here.
//
// Native clients (mobile) send neither the web client header nor a
// cookie, and browsers never let a page forge an Origin header, so
// checking Origin exactly when a browser credential is in play is both
// sufficient and invisible to mobile. SameSite on the cookie is a second
// layer, but it is configurable per topology (and may be "none" for a
// genuinely cross-site deployment), so it is never the only layer.
export function verifyWebOrigin(req: Request, _res: Response, next: NextFunction): void {
  const usesBrowserCredential = isWebClient(req) || readRefreshCookie(req) !== undefined;

  if (!usesBrowserCredential) {
    next();
    return;
  }

  const origin = req.get("origin");

  if (!origin || !env.WEB_ORIGINS.includes(origin)) {
    next(new ForbiddenError("Request origin is not allowed"));
    return;
  }

  next();
}
