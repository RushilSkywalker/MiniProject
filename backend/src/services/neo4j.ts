import neo4j, { type Driver } from "neo4j-driver";
import type { Config } from "../config.js";
import type { Candidate, Database, Result } from "../contracts.js";
import { AppError } from "../errors.js";
export function serialize(value: unknown): unknown {
  if (value == null) return null;
  if (neo4j.isInt(value))
    return value.inSafeRange() ? value.toNumber() : value.toString();
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value instanceof neo4j.types.Node)
    return {
      elementId: value.elementId,
      labels: value.labels,
      properties: serialize(value.properties),
    };
  if (value instanceof neo4j.types.Relationship)
    return {
      elementId: value.elementId,
      type: value.type,
      startElementId: value.startNodeElementId,
      endElementId: value.endNodeElementId,
      properties: serialize(value.properties),
    };
  if (
    value instanceof neo4j.types.Date ||
    value instanceof neo4j.types.DateTime ||
    value instanceof neo4j.types.LocalDateTime ||
    value instanceof neo4j.types.Time ||
    value instanceof neo4j.types.LocalTime ||
    value instanceof neo4j.types.Duration
  )
    return value.toString();
  if (value instanceof neo4j.types.Point)
    return {
      srid: serialize(value.srid),
      x: value.x,
      y: value.y,
      ...(value.z === undefined ? {} : { z: value.z }),
    };
  if (typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, serialize(item)]),
    );
  return value;
}
// Safe integers must reach Neo4j as INTEGER, especially the LIMIT parameter.
export function bindParameters(candidate: Candidate) {
  const convert = (v: unknown): unknown =>
    typeof v === "number" && Number.isSafeInteger(v)
      ? neo4j.int(v)
      : Array.isArray(v)
        ? v.map(convert)
        : v;
  return Object.fromEntries(
    Object.entries(candidate.parameters).map(([key, value]) => [
      key,
      convert(value),
    ]),
  );
}
function databaseError(
  error: unknown,
  stage: "planning" | "execution",
): AppError {
  if (error instanceof AppError) return error;
  const code =
    typeof error === "object" && error && "code" in error
      ? String(error.code)
      : "";
  if (/Timeout|TimedOut|TransactionTimedOut/.test(code))
    return new AppError(
      "DATABASE_TIMEOUT",
      "The database query timed out. Try a narrower question.",
      504,
    );
  if (/ServiceUnavailable|SessionExpired|Security|DatabaseNotFound/.test(code))
    return new AppError(
      "DATABASE_CONNECTION",
      "Could not connect to the configured Neo4j database. Check server connection settings and read permissions.",
      502,
    );
  return new AppError(
    stage === "planning" ? "DATABASE_PLANNING" : "DATABASE_EXECUTION",
    stage === "planning"
      ? "Neo4j could not plan the query. Check schema compatibility; nothing was executed."
      : "Neo4j could not execute the query. Check database availability and permissions.",
    502,
  );
}
export function createDriver(config: Config) {
  return neo4j.driver(
    config.NEO4J_URI,
    neo4j.auth.basic(config.NEO4J_USERNAME, config.NEO4J_PASSWORD),
    {
      connectionTimeout: 10000,
      connectionAcquisitionTimeout: 10000,
      maxTransactionRetryTime: 0,
    },
  );
}
export function neo4jDatabase(driver: Driver, config: Config): Database {
  async function run(candidate: Candidate, explain: boolean): Promise<Result> {
    const session = driver.session({
      database: config.NEO4J_DATABASE,
      defaultAccessMode: neo4j.session.READ,
    });
    try {
      return await session.executeRead(
        async (tx) => {
          const pending = tx.run(
            explain ? `EXPLAIN ${candidate.cypher}` : candidate.cypher,
            bindParameters(candidate),
          );
          const columns = await pending.keys();
          const result = await pending;
          if (explain) {
            const unknown = result.summary.notifications.some((n) =>
              /Unknown(Label|RelationshipType|PropertyKey)/.test(n.code),
            );
            // GQL statuses are also checked for servers that use the newer status API.
            const statuses = result.summary.gqlStatusObjects ?? [];
            if (
              unknown ||
              statuses.some((s) =>
                ["01N50", "01N51", "01N52"].includes(s.gqlStatus),
              )
            )
              throw new AppError(
                "SCHEMA_MISMATCH",
                "Neo4j reports an unknown schema identifier. Update the configured schema before retrying.",
              );
            if (result.summary.queryType !== "r")
              throw new AppError(
                "QUERY_RESTRICTED",
                "Neo4j did not classify this plan as read-only.",
              );
            return { columns: [], rows: [] };
          }
          if (result.records.length > candidate.limit)
            throw new AppError(
              "RESULT_LIMIT",
              "The database exceeded the reviewed row limit.",
            );
          return {
            columns: columns,
            rows: result.records.map((record) =>
              record.keys.map((key) => serialize(record.get(key))),
            ),
          };
        },
        { timeout: config.NEO4J_QUERY_TIMEOUT_MS },
      );
    } catch (error) {
      throw databaseError(error, explain ? "planning" : "execution");
    } finally {
      await session.close();
    }
  }
  return {
    explain: async (candidate) => {
      await run(candidate, true);
    },
    execute: (candidate) => run(candidate, false),
  };
}
