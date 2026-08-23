import { initLogger } from "evlog";

initLogger({
  drain: () => undefined,
  env: {
    environment: "test",
    service: "taskome-server",
  },
  pretty: false,
  silent: true,
});
