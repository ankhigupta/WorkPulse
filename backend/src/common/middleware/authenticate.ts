import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { UnauthorizedError } from "../errors";
import type { AuthContext } from "../../types/express";

interface AccessTokenPayload {
  sub: string;
  role: AuthContext["role"];
  organizationId: string | null;
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    next(new UnauthorizedError("Missing or malformed Authorization header"));
    return;
  }

  const token = header.slice("Bearer ".length);

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;

    req.auth = {
      userId: payload.sub,
      role: payload.role,
      organizationId: payload.organizationId,
    };

    next();
  } catch {
    next(new UnauthorizedError("Invalid or expired access token"));
  }
}
