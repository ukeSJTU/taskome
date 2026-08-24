import { getConnInfo } from "@hono/node-server/conninfo";
import { initLogger, type DrainContext } from "evlog";
import { createFsDrain } from "evlog/fs";
import { createDrainPipeline } from "evlog/pipeline";

import { createApp } from "@/app";
import { auth } from "@/auth";
import { createSessionResolver } from "@/auth/session";
import { database } from "@/db";
import { createProjectsModule } from "@/features/projects";

export type RuntimeConfig = {
  corsOrigin: string;
  environment: "development" | "production" | "test";
};

export function createRuntime(config: RuntimeConfig) {
  const drain =
    config.environment === "production"
      ? undefined
      : createDrainPipeline<DrainContext>()(createFsDrain());

  initLogger({
    ...(drain ? { drain } : {}),
    env: {
      environment: config.environment,
      service: "taskome-server",
    },
    pretty: config.environment === "development",
  });

  const app = createApp({
    authHandler: (request) => auth.handler(request),
    checkReadiness: database.check,
    corsOrigin: config.corsOrigin,
    getSession: createSessionResolver(auth),
    projects: createProjectsModule(database.db),
    resolveClientIp: (context) => getConnInfo(context).remote.address,
  });

  return {
    app,
    close: database.close,
    flushLogs: () => drain?.flush() ?? Promise.resolve(),
  };
}
