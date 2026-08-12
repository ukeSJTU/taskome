import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { PinoInstrumentation } from "@opentelemetry/instrumentation-pino";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { registerOTel } from "@vercel/otel";

const logExportEnabled =
  process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT !== undefined ||
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT !== undefined;

registerOTel({
  serviceName: process.env.OTEL_SERVICE_NAME ?? "taskome-web",
  attributes: {
    "service.version": "0.1.0",
    "deployment.environment.name": process.env.NODE_ENV ?? "development",
  },
  instrumentations: [new PinoInstrumentation()],
  logRecordProcessors: logExportEnabled
    ? [new BatchLogRecordProcessor({ exporter: new OTLPLogExporter() })]
    : [],
});
