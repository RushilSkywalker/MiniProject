import { describe, it, expect } from "vitest";
import { prepareCandidate } from "../backend/src/services/safety.js";
import { loadSchema } from "../backend/src/services/schema.js";
import { loadConfig } from "../backend/src/config.js";
import type { Generation } from "../backend/src/contracts.js";
const schema = loadSchema(loadConfig({}));
const base: Generation = {
  status: "generated",
  cypher: "MATCH (s:Product) RETURN s.name AS name LIMIT $limit",
  parameters: [{ name: "limit", type: "number", value: 100 }],
  explanation: "",
  clarification: null,
};
describe("conservative grammar", () => {
  it.each([
    "MATCH (s:Product) RETURN s.name AS name LIMIT $limit; DELETE s",
    "MATCH (s:Product) SET s.name = $value RETURN s.name AS name LIMIT $limit",
    "CALL db.labels() YIELD label RETURN label AS name LIMIT $limit",
    "LOAD CSV FROM $url AS row RETURN row AS name LIMIT $limit",
    "MATCH (s:Product)-[:IN_CATEGORY*]->(c:Category) RETURN c.name AS name LIMIT $limit",
    "MATCH (s:Product) RETURN apoc.text.join(s.name) AS name LIMIT $limit",
    "MATCH (s:Secret) RETURN s.name AS name LIMIT $limit",
    "MATCH (s:Product) RETURN s.password AS name LIMIT $limit",
    "MATCH (s:Product) RETURN s.name AS name UNION MATCH (s:Product) RETURN s.name AS name LIMIT $limit",
    "MATCH (s:Product) RETURN s.name AS name LIMIT $limit // comment",
    "MATCH (s:Product),(c:Category) RETURN s.name AS name LIMIT $limit",
    "MATCH (s:Product) RETURN collect(s) AS name LIMIT $limit",
    "MATCH (s:Product)<-[:IN_CATEGORY]-(c:Category) RETURN s.name AS name LIMIT $limit",
    'MATCH (s:Product) WHERE s.name = "SoundWave Pro" RETURN s.name AS name LIMIT $limit',
    "MATCH (s:Product) RETURN s.name AS name",
    "MATCH (s:Product) RETURN count(DISTINCT *) AS name LIMIT $limit",
  ])("rejects unsupported structure: %s", (cypher) => {
    expect(() => prepareCandidate({ ...base, cypher }, schema, 100)).toThrow();
  });
  it("honors a smaller limit and caps a larger one before review", () => {
    expect(
      prepareCandidate(
        { ...base, parameters: [{ name: "limit", type: "number", value: 3 }] },
        schema,
        100,
      ).limit,
    ).toBe(3);
    expect(prepareCandidate(base, schema, 5).parameters.limit).toBe(5);
  });
  it("rejects reuse of limit as filter parameter", () => {
    expect(() =>
      prepareCandidate(
        {
          ...base,
          cypher:
            "MATCH (s:Product) WHERE s.price = $limit RETURN s.name AS name LIMIT $limit",
        },
        schema,
        10,
      ),
    ).toThrow();
  });
  it("checks parameter types and duplicate or unused keys", () => {
    for (const parameters of [
      [{ name: "limit", type: "number", value: "100" }],
      [...base.parameters, ...base.parameters],
      [...base.parameters, { name: "unused", type: "string", value: "x" }],
    ])
      expect(() =>
        prepareCandidate({ ...base, parameters } as Generation, schema, 100),
      ).toThrow();
  });
  it("permits schema-typed relationship properties and parameterized IN", () => {
    const c = prepareCandidate(
      {
        ...base,
        cypher:
          "MATCH (s:Product)-[e:IN_CATEGORY]->(c:Category) WHERE e.since = $since AND s.name IN $names RETURN s.name AS name, c.name AS category LIMIT $limit",
        parameters: [
          ...base.parameters,
          { name: "since", type: "number", value: 2026 },
          { name: "names", type: "stringList", value: ["SoundWave Pro"] },
        ],
      },
      schema,
      100,
    );
    expect(c.limit).toBe(100);
  });
});
