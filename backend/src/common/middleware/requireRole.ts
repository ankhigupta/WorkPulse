import type { NextFunction, Request, Response } from "express";
import { ForbiddenError, UnauthorizedError } from "../errors";
import type { AuthContext } from "../../types/express";

export function requireRole(...roles: AuthContext["role"][]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new UnauthorizedError());
      return;
    }

    if (!roles.includes(req.auth.role)) {
      next(new ForbiddenError("Insufficient role for this action"));
      return;
    }

    next();
  };
}
