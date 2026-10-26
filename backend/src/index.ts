import "dotenv/config";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
const config = loadConfig();
const { app, close } = createApp(config);
const server = app.listen(config.PORT, "127.0.0.1", () =>
  console.log(
    `GraphQuery ${config.APP_MODE} API: http://127.0.0.1:${config.PORT}`,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    server.close(() => {
      void close().then(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10000).unref();
  });
