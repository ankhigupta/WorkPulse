// Mirrors backend/src/common/middleware/errorHandler.ts's error envelope.
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number | undefined,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
