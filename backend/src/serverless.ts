import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

// Vercel invokes the Express handler directly; do not open a listening port.
// Module scope reuses the app and its lazy driver during warm invocations.
export const { app } = createApp(loadConfig());
