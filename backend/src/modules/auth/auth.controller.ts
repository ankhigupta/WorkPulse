import type { Request, Response } from "express";
import { UnauthorizedError } from "../../common/errors";
import * as authService from "./auth.service";
import { clearRefreshCookie, isWebClient, readRefreshCookie, setRefreshCookie } from "./cookies";

interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: unknown;
}

// Web clients get the refresh token as an httpOnly cookie and never see it
// in the response body — the whole point is that JavaScript cannot read
// it. Every other client (mobile) keeps the original contract exactly:
// refreshToken in the JSON body, no cookie set at all.
function respondWithSession(req: Request, res: Response, status: number, result: AuthResult): void {
  if (isWebClient(req)) {
    setRefreshCookie(res, result.refreshToken);
    const { refreshToken: _refreshToken, ...web } = result;
    res.status(status).json(web);
    return;
  }

  res.status(status).json(result);
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;
  const result = await authService.login(email, password);
  respondWithSession(req, res, 200, result);
}

export async function signupOrganization(req: Request, res: Response): Promise<void> {
  const { organizationName, email, password } = req.body;
  const result = await authService.signupOrganization({ organizationName, email, password });
  respondWithSession(req, res, 201, result);
}

// Cookie first, body second. A browser session never sends a body token;
// mobile never sends a cookie. Neither present is an ordinary 401, not a
// validation error — an expired browser session and a malformed request
// should look the same to a caller.
export async function refresh(req: Request, res: Response): Promise<void> {
  const cookieToken = readRefreshCookie(req);
  const rawToken = cookieToken ?? req.body.refreshToken;

  if (!rawToken) {
    throw new UnauthorizedError("Invalid or expired refresh token");
  }

  const result = await authService.refreshTokens(rawToken);

  if (cookieToken) {
    // Rotation: the service already revoked the old token and issued a
    // new one, so the cookie has to be replaced in the same response.
    setRefreshCookie(res, result.refreshToken);
    res.status(200).json({ accessToken: result.accessToken });
    return;
  }

  res.status(200).json(result);
}

export async function logout(req: Request, res: Response): Promise<void> {
  const cookieToken = readRefreshCookie(req);
  const rawToken = cookieToken ?? req.body.refreshToken;

  // Revoke server-side first, then clear the browser's copy. Clearing the
  // cookie unconditionally (even when no token was supplied) keeps logout
  // idempotent for a browser whose session already expired.
  if (rawToken) {
    await authService.logout(rawToken);
  }

  if (cookieToken || isWebClient(req)) {
    clearRefreshCookie(res);
  }

  res.status(204).send();
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = await authService.getCurrentUser(req.auth!.userId);
  res.status(200).json(user);
}
