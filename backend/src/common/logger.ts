import pino from "pino";
import { env } from "./config/env";

function resolveLevel(): string {
  if (env.NODE_ENV === "production") return "info";
  if (env.NODE_ENV === "test") return "silent";
  return "debug";
}

export const logger = pino({
  level: resolveLevel(),
});
