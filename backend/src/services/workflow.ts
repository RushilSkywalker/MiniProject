import { performance } from "node:perf_hooks";
import {
  generationSchema,
  reviewSchema,
  type Database,
  type Generator,
  type GraphSchema,
  type QueryResponse,
  type Reviewer,
} from "../contracts.js";
import { AppError, publicError } from "../errors.js";
import { prepareCandidate } from "./safety.js";
export async function runWorkflow(
  question: string,
  schema: GraphSchema,
  services: { generator: Generator; reviewer: Reviewer; database: Database },
  mode: "demo" | "live",
  maxRows: number,
): Promise<QueryResponse> {
  const start = performance.now();
  const output: QueryResponse = {
    ok: false,
    mode,
    status: "error",
    message: "",
    elapsedMs: 0,
  };
  try {
    const parsed = generationSchema.safeParse(
      await services.generator.generate(question, schema, maxRows),
    );
    if (!parsed.success)
      throw new AppError(
        "MODEL_INVALID",
        "Invalid generation response. Nothing was executed.",
      );
    const generated = parsed.data;
    output.generation = generated;
    if (generated.status !== "generated") {
      if (
        generated.cypher !== null ||
        generated.parameters.length ||
        (generated.status === "clarification_required" &&
          !generated.clarification?.trim())
      )
        throw new AppError(
          "MODEL_INVALID",
          "Inconsistent generation response. Nothing was executed.",
        );
      output.status = generated.status;
      output.message = generated.clarification ?? generated.explanation;
      return output;
    }
    if (generated.clarification !== null)
      throw new AppError(
        "MODEL_INVALID",
        "The generated query also asks for clarification. Nothing was executed.",
      );
    const candidate = prepareCandidate(generated, schema, maxRows);
    // Freeze the finalized candidate so adapters cannot mutate it after approval.
    Object.values(candidate.parameters).forEach((value) => {
      if (Array.isArray(value)) Object.freeze(value);
    });
    Object.freeze(candidate.parameters);
    Object.freeze(candidate);
    output.candidate = candidate;
    const review = reviewSchema.safeParse(
      await services.reviewer.review(question, schema, candidate),
    );
    if (!review.success)
      throw new AppError(
        "MODEL_INVALID",
        "Invalid reviewer response. Nothing was executed.",
      );
    output.review = review.data;
    if (review.data.verdict !== "approved") {
      if (
        review.data.verdict === "clarification_required" &&
        !review.data.clarification?.trim()
      )
        throw new AppError(
          "MODEL_INVALID",
          "The reviewer requested clarification without a question.",
        );
      output.status = review.data.verdict;
      output.message = review.data.clarification ?? review.data.explanation;
      return output;
    }
    if (review.data.issues.length || review.data.clarification !== null)
      throw new AppError(
        "MODEL_INVALID",
        "Reviewer approval contained unresolved issues. Nothing was executed.",
      );
    await services.database.explain(candidate);
    const result = await services.database.execute(candidate);
    if (result.rows.length > candidate.limit)
      throw new AppError("RESULT_LIMIT", "Result row limit exceeded.");
    output.result = result;
    output.rowCount = result.rows.length;
    output.limitReached = result.rows.length === candidate.limit;
    output.ok = true;
    output.status = result.rows.length ? "success" : "empty";
    output.message = result.rows.length
      ? "Query completed."
      : "No matching records were found.";
    return output;
  } catch (error) {
    const safe = publicError(error);
    output.error = { code: safe.code, message: safe.message };
    output.message = safe.message;
    return output;
  } finally {
    output.elapsedMs = Math.round(performance.now() - start);
  }
}
