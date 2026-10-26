import { z } from "zod";
export const parameterSchema = z
  .object({
    name: z.string(),
    type: z.enum(["string", "number", "boolean", "stringList", "numberList"]),
    value: z.union([
      z.string(),
      z.number(),
      z.boolean(),
      z.array(z.string()),
      z.array(z.number()),
    ]),
  })
  .strict();
export const generationSchema = z
  .object({
    status: z.enum(["generated", "clarification_required", "unsupported"]),
    cypher: z.string().nullable(),
    parameters: z.array(parameterSchema),
    explanation: z.string(),
    clarification: z.string().nullable(),
  })
  .strict();
export const reviewSchema = z
  .object({
    verdict: z.enum(["approved", "rejected", "clarification_required"]),
    explanation: z.string(),
    issues: z.array(z.string()),
    clarification: z.string().nullable(),
  })
  .strict();
export type Generation = z.infer<typeof generationSchema>;
export type Review = z.infer<typeof reviewSchema>;
export type ParameterValue = z.infer<typeof parameterSchema>["value"];
export type Candidate = {
  cypher: string;
  parameters: Record<string, ParameterValue>;
  limit: number;
};
export type GraphSchema = {
  name: string;
  nodes: {
    label: string;
    description: string;
    properties: Record<string, "string" | "number" | "boolean">;
  }[];
  relationships: {
    type: string;
    from: string;
    to: string;
    description: string;
    properties: Record<string, "string" | "number" | "boolean">;
  }[];
};
export type Result = { columns: string[]; rows: unknown[][] };
export interface Generator {
  generate(
    question: string,
    schema: GraphSchema,
    maxRows: number,
  ): Promise<unknown>;
}
export interface Reviewer {
  review(
    question: string,
    schema: GraphSchema,
    candidate: Candidate,
  ): Promise<unknown>;
}
export interface Database {
  explain(candidate: Candidate): Promise<void>;
  execute(candidate: Candidate): Promise<Result>;
}
export type QueryResponse = {
  ok: boolean;
  mode: "demo" | "live";
  status:
    | "success"
    | "empty"
    | "clarification_required"
    | "unsupported"
    | "rejected"
    | "error";
  message: string;
  elapsedMs: number;
  generation?: Generation;
  candidate?: Candidate;
  review?: Review;
  result?: Result;
  rowCount?: number;
  limitReached?: boolean;
  error?: { code: string; message: string };
};
