import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { z } from "zod";
import { ValidationError } from "../errors";

export function validate(schema: z.ZodTypeAny): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      next(new ValidationError("Invalid request body", result.error.flatten()));
      return;
    }

    req.body = result.data;
    next();
  };
}
