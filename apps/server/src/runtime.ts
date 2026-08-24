import { getConnInfo } from "@hono/node-server/conninfo";
import { initLogger, type DrainContext } from "evlog";
import { createFsDrain } from "evlog/fs";
import { createDrainPipeline } from "evlog/pipeline";

import { createApp } from "@/app";
import { auth } from "@/auth";
import { createTaskomeMcpHandler } from "@/auth/mcp";
import { createOAuthGrantService } from "@/auth/oauth-grants";
import { createSessionResolver } from "@/auth/session";
import { database } from "@/db";
import { createApiKeyService } from "@/features/api-keys";
import { createOAuthGrantManagementService } from "@/features/oauth-grants";
import { createProjectsModule } from "@/features/projects";

export type RuntimeConfig = {
  corsOrigin: string;
  environment: "development" | "production" | "test";
  serverOrigin: string;
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
    apiKeyService: createApiKeyService(auth, database.db),
    authHandler: (request) => auth.handler(request),
    checkReadiness: database.check,
    corsOrigin: config.corsOrigin,
    getSession: createSessionResolver(auth),
    mcpHandler: createTaskomeMcpHandler(
      auth,
      createOAuthGrantService(database.db),
      config.serverOrigin,
    ),
    oauthGrantService: createOAuthGrantManagementService(database.db),
    projects: createProjectsModule(database.db),
    resolveClientIp: (context) => getConnInfo(context).remote.address,
  });

  return {
    app,
    close: database.close,
    flushLogs: () => drain?.flush() ?? Promise.resolve(),
  };
}
