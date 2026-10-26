import express from "express";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import { resolve } from "node:path";
import { z } from "zod";
import type { Driver } from "neo4j-driver";
import { assertLiveConfig, type Config } from "./config.js";
import { publicError } from "./errors.js";
import { loadSchema } from "./services/schema.js";
import { demoAdapters } from "./demo/adapters.js";
import { examples, specialExamples } from "./demo/fixtures.js";
import { createOpenAI } from "./services/openai.js";
import { liveGenerator } from "./services/generation.js";
import { liveReviewer } from "./services/review.js";
import { createDriver, neo4jDatabase } from "./services/neo4j.js";
import { runWorkflow } from "./services/workflow.js";
const requestSchema = z
  .object({ question: z.string().trim().min(1).max(1000) })
  .strict();
export function createApp(config: Config) {
  const app = express();
  let driver: Driver | undefined;
  app.disable("x-powered-by");
  app.use(cors({ origin: config.FRONTEND_ORIGIN }));
  app.use(express.json({ limit: "16kb" }));
  const errorBody = (code: string, message: string) => ({
    ok: false,
    mode: config.APP_MODE,
    status: "error",
    message,
    error: { code, message },
    elapsedMs: 0,
  });
  app.use(
    "/api/query",
    rateLimit({
      windowMs: 60000,
      limit: 20,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      handler: (_req, res) => {
        res
          .status(429)
          .json(
            errorBody(
              "RATE_LIMIT",
              "Too many requests. Wait a minute and try again.",
            ),
          );
      },
    }),
  );
  function ready() {
    if (config.APP_MODE === "live") assertLiveConfig(config);
    return loadSchema(config);
  }
  app.get("/api/health", (_req, res) => {
    try {
      const schema = ready();
      res.json({
        ok: true,
        mode: config.APP_MODE,
        configured: true,
        connectivity: "not_checked",
        schemaName: schema.name,
        maxRows: config.MAX_RESULT_ROWS,
        examples: config.APP_MODE === "demo" ? examples : [],
        specialExamples: config.APP_MODE === "demo" ? specialExamples : [],
      });
    } catch (error) {
      const safe = publicError(error);
      res
        .status(503)
        .json({ ...errorBody(safe.code, safe.message), configured: false });
    }
  });
  app.post("/api/query", async (req, res) => {
    const input = requestSchema.safeParse(req.body);
    if (!input.success) {
      res
        .status(400)
        .json(
          errorBody(
            "INVALID_INPUT",
            "Send only an English question between 1 and 1,000 characters.",
          ),
        );
      return;
    }
    try {
      const schema = ready();
      let services;
      if (config.APP_MODE === "demo") services = demoAdapters();
      else {
        const client = createOpenAI(config.OPENAI_API_KEY);
        driver ??= createDriver(config);
        services = {
          generator: liveGenerator(client, config.OPENAI_GENERATION_MODEL),
          reviewer: liveReviewer(client, config.OPENAI_VALIDATION_MODEL),
          database: neo4jDatabase(driver, config),
        };
      }
      const response = await runWorkflow(
        input.data.question,
        schema,
        services,
        config.APP_MODE,
        config.MAX_RESULT_ROWS,
      );
      const status = response.error
        ? /TIMEOUT/.test(response.error.code)
          ? 504
          : /AUTH|UNAVAILABLE|CONNECTION|PLANNING|EXECUTION/.test(
                response.error.code,
              )
            ? 502
            : /RATE_LIMIT/.test(response.error.code)
              ? 429
              : 422
        : 200;
      res.status(status).json(response);
    } catch (error) {
      const safe = publicError(error);
      res.status(safe.httpStatus).json(errorBody(safe.code, safe.message));
    }
  });
  app.use("/api", (_req, res) => {
    res.status(404).json(errorBody("NOT_FOUND", "API endpoint not found."));
  });
  app.use(express.static(resolve("dist/client")));
  app.get("/", (_req, res) => {
    res.sendFile(resolve("dist/client/index.html"));
  });
  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const status =
        typeof error === "object" && error && "status" in error
          ? error.status
          : undefined;
      res
        .status(status === 413 ? 413 : 400)
        .json(
          errorBody(
            "INVALID_REQUEST",
            status === 413
              ? "Request body is too large."
              : "Invalid JSON request.",
          ),
        );
    },
  );
  return {
    app,
    close: async () => {
      await driver?.close();
    },
  };
}
