import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "../backend/src/app.js";
import { loadConfig } from "../backend/src/config.js";
import { examples, specialExamples } from "../backend/src/demo/fixtures.js";
afterEach(() => vi.restoreAllMocks());
describe("HTTP API", () => {
  it("runs all demos without credentials or fetch calls", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("Network forbidden"));
    const { app } = createApp(loadConfig({}));
    const health = await request(app).get("/api/health");
    expect(health.body.mode).toBe("demo");
    for (const [i, question] of examples.entries()) {
      const r = await request(app).post("/api/query").send({ question });
      expect(r.status).toBe(200);
      expect(r.body.status).toBe("success");
      expect(r.body.rowCount).toBe([2, 2, 2, 2, 4][i]);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it("returns the exact catalog matches in the reviewed sort order", async () => {
    const { app } = createApp(loadConfig({}));
    const expectedNames = [
      ["BeatLite Air", "SoundWave Pro"],
      ["WorkBook 14", "CreatorBook 15"],
      ["SoundWave Pro", "QuietStudio Max"],
      ["Quiet commute", "Comfortable for work"],
      ["QuietStudio Max", "CreatorBook 15", "SoundWave Pro", "WorkBook 14"],
    ];
    for (const [i, question] of examples.entries()) {
      const response = await request(app).post("/api/query").send({ question });
      expect(response.body.result.rows.map((row: unknown[]) => row[0])).toEqual(
        expectedNames[i],
      );
      if (i !== 3) {
        expect(response.body.result.columns).toEqual([
          "product",
          "priceINR",
          "rating",
          "reviewCount",
        ]);
      } else {
        expect(
          response.body.result.rows.every((row: unknown[]) => row[3] === true),
        ).toBe(true);
      }
    }
  });
  it("excludes unavailable products and honors the configured row cap", async () => {
    const { app } = createApp(loadConfig({ MAX_RESULT_ROWS: "1" }));
    const response = await request(app)
      .post("/api/query")
      .send({ question: examples[0] });
    expect(response.body.result.rows).toEqual([
      ["BeatLite Air", 2499, 4.2, 135],
    ]);
    expect(response.body.candidate.parameters.limit).toBe(1);
    expect(response.body.limitReached).toBe(true);
  });
  it("removes the college examples from health and rejects the old questions", async () => {
    const { app } = createApp(loadConfig({}));
    const health = await request(app).get("/api/health");
    expect(health.body.examples).toEqual(examples);
    expect(health.body.schemaName).toBe("E-commerce product catalog");
    const response = await request(app)
      .post("/api/query")
      .send({ question: "List all students in semester 5." });
    expect(response.body.status).toBe("unsupported");
    expect(response.body.result).toBeUndefined();
  });
  it("covers empty, clarification, rejection and unsupported", async () => {
    const { app } = createApp(loadConfig({}));
    for (const [i, question] of [
      ...specialExamples,
      "Tell me the weather",
    ].entries()) {
      const r = await request(app).post("/api/query").send({ question });
      expect(r.body.status).toBe(
        ["empty", "clarification_required", "rejected", "unsupported"][i],
      );
      if (i > 0) expect(r.body.result).toBeUndefined();
    }
  });
  it.each([
    { question: "" },
    { question: " ".repeat(4) },
    { question: 5 },
    { question: "a".repeat(1001) },
    { cypher: "MATCH (n) RETURN n" },
    { question: "Products", skipReview: true },
  ])("validates requests", async (body) => {
    expect(
      (
        await request(createApp(loadConfig({})).app)
          .post("/api/query")
          .send(body)
      ).status,
    ).toBe(400);
  });
  it("returns clear missing-live-config errors, never demo data", async () => {
    const { app } = createApp(loadConfig({ APP_MODE: "live" }));
    const h = await request(app).get("/api/health");
    expect(h.status).toBe(503);
    expect(h.body.configured).toBe(false);
    const q = await request(app)
      .post("/api/query")
      .send({ question: examples[0] });
    expect(q.status).toBe(503);
    expect(q.body.error.code).toBe("LIVE_CONFIGURATION");
    expect(q.body.result).toBeUndefined();
  });
  it("does not fall back to the demo schema", async () => {
    const { app } = createApp(
      loadConfig({
        APP_MODE: "live",
        OPENAI_API_KEY: "test-only",
        NEO4J_URI: "neo4j://localhost",
        NEO4J_USERNAME: "test-only",
        NEO4J_PASSWORD: "test-only",
        NEO4J_DATABASE: "test-only",
        GRAPH_SCHEMA_PATH: "does-not-exist.json",
      }),
    );
    expect((await request(app).get("/api/health")).body.error.code).toBe(
      "SCHEMA_CONFIGURATION",
    );
  });
  it("limits request rate", async () => {
    const { app } = createApp(loadConfig({}));
    for (let i = 0; i < 20; i++)
      await request(app).post("/api/query").send({ question: "unsupported" });
    expect(
      (await request(app).post("/api/query").send({ question: "unsupported" }))
        .status,
    ).toBe(429);
  });
});
