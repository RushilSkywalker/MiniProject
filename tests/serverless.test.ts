import { afterEach, expect, it, vi } from "vitest";
import request from "supertest";
import { examples } from "../backend/src/demo/fixtures.js";

afterEach(() => vi.unstubAllEnvs());
it("serves health and a complete demo through the Vercel entry points", async () => {
  vi.stubEnv("APP_MODE", "demo");
  const { default: health } = await import("../api/health.js");
  const { default: query } = await import("../api/query.js");
  expect(health).toBe(query);
  const status = await request(health).get("/api/health");
  expect(status.status).toBe(200);
  expect(status.body.mode).toBe("demo");
  const result = await request(query).post("/api/query").send({ question: examples[0] });
  expect(result.status).toBe(200);
  expect(result.body.result.rows.map((row: unknown[]) => row[0])).toEqual(["BeatLite Air", "SoundWave Pro"]);
});
