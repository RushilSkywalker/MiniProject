import { describe, it, expect, vi } from "vitest";
import { runWorkflow } from "../backend/src/services/workflow.js";
import { loadSchema } from "../backend/src/services/schema.js";
import { loadConfig } from "../backend/src/config.js";
import { AppError } from "../backend/src/errors.js";
import type { Generation, Review } from "../backend/src/contracts.js";
const schema = loadSchema(loadConfig({}));
export const valid: Generation = {
  status: "generated",
  cypher:
    "MATCH (s:Product) WHERE s.price = $price RETURN s.name AS product ORDER BY product ASC LIMIT $limit",
  parameters: [
    { name: "price", type: "number", value: 5 },
    { name: "limit", type: "number", value: 100 },
  ],
  explanation: "Lists price 5 products.",
  clarification: null,
};
const approval: Review = {
  verdict: "approved",
  explanation: "Matches the question.",
  issues: [],
  clarification: null,
};
function mocks(generation: unknown = valid, review: unknown = approval) {
  const order: string[] = [];
  return {
    order,
    generator: {
      generate: vi.fn(async () => {
        order.push("generate");
        return structuredClone(generation);
      }),
    },
    reviewer: {
      review: vi.fn(async () => {
        order.push("review");
        return review;
      }),
    },
    database: {
      explain: vi.fn(async () => {
        order.push("explain");
      }),
      execute: vi.fn(async () => {
        order.push("execute");
        return { columns: ["product"], rows: [["SoundWave Pro"]] };
      }),
    },
  };
}
describe("workflow gates", () => {
  it("executes only after generation, review and EXPLAIN; preserves the exact reviewed candidate", async () => {
    const s = mocks();
    const result = await runWorkflow(
      "List products in price 5",
      schema,
      s,
      "live",
      10,
    );
    expect(result.ok).toBe(true);
    expect(s.order).toEqual(["generate", "review", "explain", "execute"]);
    const candidate = s.reviewer.review.mock.calls[0] as unknown[];
    expect(s.database.explain.mock.calls[0]).toEqual([candidate[2]]);
    expect(s.database.execute.mock.calls[0]).toEqual([candidate[2]]);
    expect(result.candidate?.parameters.limit).toBe(10);
    expect(Object.isFrozen(result.candidate?.parameters)).toBe(true);
  });
  it.each(["rejected", "clarification_required"] as const)(
    "does not execute reviewer verdict %s",
    async (verdict) => {
      const s = mocks(valid, {
        ...approval,
        verdict,
        clarification:
          verdict === "clarification_required" ? "Which price?" : null,
      });
      const result = await runWorkflow("Products?", schema, s, "live", 100);
      expect(result.status).toBe(verdict);
      expect(s.database.explain).not.toHaveBeenCalled();
      expect(s.database.execute).not.toHaveBeenCalled();
    },
  );
  it("stops on generator clarification without a reviewer call", async () => {
    const s = mocks({
      ...valid,
      status: "clarification_required",
      cypher: null,
      parameters: [],
      clarification: "Which price?",
    });
    expect(
      (await runWorkflow("Products?", schema, s, "live", 100)).status,
    ).toBe("clarification_required");
    expect(s.reviewer.review).not.toHaveBeenCalled();
    expect(s.database.execute).not.toHaveBeenCalled();
  });
  it.each([
    {},
    { ...valid, parameters: [] },
    { ...valid, cypher: "MATCH (s:Product) DELETE s" },
    { ...valid, clarification: "Maybe?" },
  ])(
    "blocks malformed, unsafe and missing-parameter candidates",
    async (generation) => {
      const s = mocks(generation);
      const result = await runWorkflow("Products", schema, s, "live", 100);
      expect(result.status).toBe("error");
      expect(s.reviewer.review).not.toHaveBeenCalled();
      expect(s.database.execute).not.toHaveBeenCalled();
    },
  );
  it("does not accept ambiguous approval", async () => {
    const s = mocks(valid, { ...approval, issues: ["Wrong price"] });
    expect(
      (await runWorkflow("Products", schema, s, "live", 100)).error?.code,
    ).toBe("MODEL_INVALID");
    expect(s.database.execute).not.toHaveBeenCalled();
  });
  it("blocks malformed reviewer output", async () => {
    const s = mocks(valid, { approved: true });
    await runWorkflow("Products", schema, s, "live", 100);
    expect(s.database.explain).not.toHaveBeenCalled();
  });
  it("stops on planning failure", async () => {
    const s = mocks();
    s.database.explain.mockRejectedValue(
      new AppError("DATABASE_PLANNING", "Invalid plan"),
    );
    const r = await runWorkflow("Products", schema, s, "live", 100);
    expect(r.error?.code).toBe("DATABASE_PLANNING");
    expect(s.database.execute).not.toHaveBeenCalled();
  });
  it("does not substitute demo results on live failures or expose stack traces", async () => {
    const s = mocks();
    s.database.execute.mockRejectedValue(
      new Error("secret password internal stack"),
    );
    const r = await runWorkflow("Products", schema, s, "live", 100);
    expect(r.mode).toBe("live");
    expect(r.result).toBeUndefined();
    expect(JSON.stringify(r)).not.toContain("secret password");
  });
});
