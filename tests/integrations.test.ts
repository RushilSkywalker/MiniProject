import { describe, it, expect, vi } from "vitest";
import neo4j, { type Driver } from "neo4j-driver";
import type OpenAI from "openai";
import {
  serialize,
  bindParameters,
  neo4jDatabase,
} from "../backend/src/services/neo4j.js";
import { liveGenerator } from "../backend/src/services/generation.js";
import { liveReviewer } from "../backend/src/services/review.js";
import { loadConfig } from "../backend/src/config.js";
import { loadSchema } from "../backend/src/services/schema.js";
import type { Candidate } from "../backend/src/contracts.js";
const candidate: Candidate = {
  cypher: "MATCH (s:Product) RETURN s.name AS name LIMIT $limit",
  parameters: { limit: 10 },
  limit: 10,
};
describe("SDK integrations (mocked)", () => {
  it("makes separate structured Responses calls without generator explanation in review", async () => {
    const generated = {
      status: "generated",
      cypher: candidate.cypher,
      parameters: [{ name: "limit", type: "number", value: 10 }],
      explanation: "GENERATOR_PRIVATE_REASON",
      clarification: null,
    };
    const approved = {
      verdict: "approved",
      explanation: "Correct",
      issues: [],
      clarification: null,
    };
    const parse = vi
      .fn()
      .mockResolvedValueOnce({
        status: "completed",
        output: [],
        output_parsed: generated,
      })
      .mockResolvedValueOnce({
        status: "completed",
        output: [],
        output_parsed: approved,
      });
    const client = { responses: { parse } } as unknown as OpenAI;
    const schema = loadSchema(loadConfig({}));
    await liveGenerator(client, "generation-model").generate(
      "Products",
      schema,
      10,
    );
    await liveReviewer(client, "review-model").review(
      "Products",
      schema,
      candidate,
    );
    expect(parse).toHaveBeenCalledTimes(2);
    expect(parse.mock.calls[0][0].model).toBe("generation-model");
    expect(parse.mock.calls[1][0].model).toBe("review-model");
    expect(parse.mock.calls[0][0].text.format.type).toBe("json_schema");
    expect(JSON.stringify(parse.mock.calls[1])).not.toContain(
      "GENERATOR_PRIVATE_REASON",
    );
    expect(
      JSON.parse(parse.mock.calls[1][0].input[1].content).parameters,
    ).toEqual(candidate.parameters);
  });
  it.each([
    { status: "incomplete", output: [], output_parsed: null },
    {
      status: "completed",
      output: [{ type: "message", content: [{ type: "refusal" }] }],
      output_parsed: null,
    },
    { status: "completed", output: [], output_parsed: {} },
  ])("rejects incomplete, refusal and invalid output", async (response) => {
    const client = {
      responses: { parse: vi.fn().mockResolvedValue(response) },
    } as unknown as OpenAI;
    await expect(
      liveGenerator(client, "test").generate(
        "Products",
        loadSchema(loadConfig({})),
        100,
      ),
    ).rejects.toThrow();
  });
  it("serializes large integers, nodes, relationships, lists and temporal values", () => {
    const node = new neo4j.types.Node(
      neo4j.int(1),
      ["Product"],
      { name: "SoundWave Pro", score: neo4j.int(10) },
      "node-1",
    );
    const relationship = new neo4j.types.Relationship(
      neo4j.int(2),
      neo4j.int(1),
      neo4j.int(3),
      "IN_CATEGORY",
      { since: neo4j.int(2026) },
      "rel-2",
      "node-1",
      "node-3",
    );
    expect(
      serialize({
        small: neo4j.int(42),
        large: neo4j.int("9007199254740993"),
        nil: null,
        list: [node, relationship],
        date: new neo4j.types.Date(2026, 10, 25),
      }),
    ).toEqual({
      small: 42,
      large: "9007199254740993",
      nil: null,
      list: [
        {
          elementId: "node-1",
          labels: ["Product"],
          properties: { name: "SoundWave Pro", score: 10 },
        },
        {
          elementId: "rel-2",
          type: "IN_CATEGORY",
          startElementId: "node-1",
          endElementId: "node-3",
          properties: { since: 2026 },
        },
      ],
      date: "2026-10-25",
    });
    expect(neo4j.isInt(bindParameters(candidate).limit)).toBe(true);
  });
  it("closes sessions after planning failure and blocks unknown schema notifications", async () => {
    const close = vi.fn();
    const run = vi.fn().mockReturnValue(
      Object.assign(
        Promise.resolve({
          records: [],
          summary: {
            notifications: [
              {
                code: "Neo.ClientNotification.Statement.UnknownLabelWarning",
              },
            ],
            gqlStatusObjects: [],
            queryType: "r",
          },
        }),
        { keys: async () => [] },
      ),
    );
    const session = {
      close,
      executeRead: vi.fn(async (fn, _options) => fn({ run })),
    };
    const driver = { session: vi.fn(() => session) } as unknown as Driver;
    await expect(
      neo4jDatabase(driver, loadConfig({})).explain(candidate),
    ).rejects.toThrow("unknown schema");
    expect(close).toHaveBeenCalledOnce();
    expect(session.executeRead.mock.calls[0][1]).toEqual({ timeout: 10000 });
    expect(run.mock.calls[0][0]).toBe(`EXPLAIN ${candidate.cypher}`);
  });
});
