import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import type { Config } from "../config.js";
import { AppError } from "../errors.js";
const identifier = z
  .string()
  .regex(/^[A-Za-z][A-Za-z0-9_]*$/)
  .refine((v) => !["__proto__", "constructor", "prototype"].includes(v));
const properties = z.record(
  identifier,
  z.enum(["string", "number", "boolean"]),
);
export const graphSchemaValidator = z
  .object({
    name: z.string().min(1),
    nodes: z
      .array(
        z
          .object({ label: identifier, description: z.string(), properties })
          .strict(),
      )
      .min(1),
    relationships: z.array(
      z
        .object({
          type: identifier,
          from: identifier,
          to: identifier,
          description: z.string(),
          properties,
        })
        .strict(),
    ),
  })
  .strict()
  .superRefine((schema, ctx) => {
    const labels = schema.nodes.map((n) => n.label);
    if (new Set(labels).size !== labels.length)
      ctx.addIssue({ code: "custom", message: "Duplicate node labels" });
    const patterns = schema.relationships.map(
      (r) => `${r.from}/${r.type}/${r.to}`,
    );
    if (new Set(patterns).size !== patterns.length)
      ctx.addIssue({
        code: "custom",
        message: "Duplicate relationship patterns",
      });
    for (const r of schema.relationships)
      if (!labels.includes(r.from) || !labels.includes(r.to))
        ctx.addIssue({
          code: "custom",
          message: "Unknown relationship endpoint",
        });
  });
export function loadSchema(config: Config) {
  try {
    const path =
      config.APP_MODE === "demo"
        ? "backend/config/demo-schema.json"
        : config.GRAPH_SCHEMA_PATH;
    return graphSchemaValidator.parse(
      JSON.parse(readFileSync(resolve(path), "utf8")),
    );
  } catch {
    throw new AppError(
      "SCHEMA_CONFIGURATION",
      `A valid ${config.APP_MODE} graph schema is required. Check the server schema file and README format.`,
      503,
    );
  }
}
