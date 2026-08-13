import "server-only";

import { env } from "@taskome/env/server";
import pino, { type DestinationStream } from "pino";

const logLevel = env.LOG_LEVEL ?? (env.NODE_ENV === "development" ? "debug" : "info");

export function createLogger(destination?: DestinationStream) {
  return pino(
    {
      level: logLevel,
      base: {
        service_name: process.env.OTEL_SERVICE_NAME ?? "taskome-web",
        deployment_environment: env.NODE_ENV,
      },
      redact: {
        paths: [
          "authorization",
          "api_key",
          "body",
          "cookie",
          "password",
          "token",
          "secret",
          "session",
          "signature",
          "x_api_key",
          "*.authorization",
          "*.api_key",
          "*.body",
          "*.cookie",
          "*.password",
          "*.token",
          "*.secret",
          "*.session",
          "*.signature",
          "*.x_api_key",
        ],
        censor: "[Redacted]",
      },
      transport:
        destination === undefined && env.NODE_ENV === "development"
          ? {
              target: "pino-pretty",
              options: { colorize: process.stdout.isTTY },
            }
          : undefined,
    },
    destination,
  );
}

export const logger = createLogger();
