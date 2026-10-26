import { z } from "zod";
import { AppError } from "./errors.js";
const settings = z.object({
  APP_MODE: z.enum(["demo", "live"]).default("demo"),
  MAX_RESULT_ROWS: z.coerce.number().int().min(1).max(1000).default(100),
  NEO4J_QUERY_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(100)
    .max(60000)
    .default(10000),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  FRONTEND_ORIGIN: z.string().url().default("http://127.0.0.1:5173"),
  OPENAI_API_KEY: z.string().default(""),
  OPENAI_GENERATION_MODEL: z.string().default("gpt-4.1-mini"),
  OPENAI_VALIDATION_MODEL: z.string().default("gpt-4.1-mini"),
  NEO4J_URI: z.string().default(""),
  NEO4J_USERNAME: z.string().default(""),
  NEO4J_PASSWORD: z.string().default(""),
  NEO4J_DATABASE: z.string().default(""),
  GRAPH_SCHEMA_PATH: z.string().default("backend/config/live-schema.json"),
});
export type Config = z.infer<typeof settings>;
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return settings.parse(env);
}
export function assertLiveConfig(config: Config) {
  const keys = [
    "OPENAI_API_KEY",
    "OPENAI_GENERATION_MODEL",
    "OPENAI_VALIDATION_MODEL",
    "NEO4J_URI",
    "NEO4J_USERNAME",
    "NEO4J_PASSWORD",
    "NEO4J_DATABASE",
    "GRAPH_SCHEMA_PATH",
  ] as const;
  const missing = keys.filter((key) => !config[key].trim());
  if (missing.length)
    throw new AppError(
      "LIVE_CONFIGURATION",
      `Live mode needs: ${missing.join(", ")}. Configure server .env and restart.`,
      503,
    );
  if (!/^(neo4j|bolt)(\+s|\+ssc)?:\/\//.test(config.NEO4J_URI))
    throw new AppError(
      "LIVE_CONFIGURATION",
      "NEO4J_URI must be a Neo4j or Bolt connection URI.",
      503,
    );
}
