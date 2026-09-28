import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { z } from "zod";
import { ValidationError } from "../errors";

// "query" is a separate source, not just a different key to validate on
// req.body: Express 5 defines req.query as a getter-only accessor
// (recomputed from the URL on every read), so it can't be reassigned the
// way req.body can. Validated query params land on req.validatedQuery
// instead — see types/express.d.ts.
export function validate(schema: z.ZodTypeAny, source: "body" | "query" = "body"): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const input = source === "query" ? req.query : req.body;
    const result = schema.safeParse(input);

    if (!result.success) {
      next(new ValidationError(`Invalid request ${source}`, result.error.flatten()));
      return;
    }

    if (source === "query") {
      req.validatedQuery = result.data as Record<string, unknown>;
    } else {
      req.body = result.data;
    }

    next();
  };
}
