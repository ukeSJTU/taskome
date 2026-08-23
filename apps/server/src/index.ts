import { serve } from "@hono/node-server";
import { env } from "@taskome/env/server";
import { createLogger } from "evlog";

import { createRuntime } from "@/runtime";

const runtime = createRuntime({
  corsOrigin: env.CORS_ORIGIN,
  environment: env.NODE_ENV,
});

const server = serve(
  {
    fetch: runtime.app.fetch,
    port: env.PORT,
  },
  (info) => {
    createLogger({
      action: "server.started",
      server: { port: info.port },
    }).emit();
  },
);

let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  const log = createLogger({ action: "server.stopping", signal });
  const deadline = setTimeout(() => {
    log.error("Graceful shutdown exceeded 10 seconds");
    if ("closeAllConnections" in server) {
      server.closeAllConnections();
    }
    process.exitCode = 1;
  }, 10_000);
  deadline.unref();

  try {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
    await runtime.close();
    log.emit();
  } catch (error) {
    log.error(error instanceof Error ? error : String(error));
    log.emit();
    process.exitCode = 1;
  } finally {
    clearTimeout(deadline);
    await runtime.flushLogs();
  }
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
