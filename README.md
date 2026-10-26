# GraphQuery: Natural Language to Neo4j Cypher

A fifth-semester VTU mini project that searches an e-commerce product catalog through English questions. Inspect the generated Cypher, a separate AI review, and the actual query results. The code uses direct SDK calls and small service modules so its architecture can be explained in a viva.

## Quick start — no credentials needed

Prerequisites: Node.js **22.12+** (Node 22 LTS recommended) and npm. Run every command from this repository root.

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. The API runs at http://127.0.0.1:3001. Choose an example, then click **Ask GraphQuery**. You do not need an `.env` file for demo mode. Stop both development processes with Ctrl+C.

```sh
npm test            # focused Vitest tests
npm run typecheck  # frontend, backend, and tests
npm run build      # type checks + Vite frontend + compiled backend
npm start          # serves the built UI and API at http://127.0.0.1:3001
```

`npm install` is also supported; `npm ci` reproduces the committed lockfile. The development Vite proxy targets port 3001. If changing `PORT` for development, update the proxy in `vite.config.ts` too. Production uses the same Express origin. This project binds to localhost and has no authentication; it is intended for local demonstrations, not an unprotected public deployment.

## Deploy the demo to Vercel

The repository includes `vercel.json` and serverless entry points in `api/`. Vercel serves the built frontend from `dist/client`; `/api/health` and `/api/query` invoke the existing Express workflow without starting a listening server. The demo schema is included in the function bundle.

1. Commit and push the updated project to the repository connected to Vercel.
2. In the Vercel project settings, set **Root Directory** to the repository root (leave blank / `.`), **not** `frontend` or `backend`.
3. Use **Vite** as the framework preset. The committed configuration specifies **Install Command:** `npm ci`, **Build Command:** `npm run build`, and **Output Directory:** `dist/client`. Remove conflicting dashboard overrides.
4. Use Node.js **22.x**. Set `APP_MODE=demo` in Vercel Environment Variables, with no API keys needed.
5. Redeploy the latest commit. Check `/` and `/api/health` on the deployment URL, then submit a demo question. If a successful deployment still gives a platform 404, check that the custom/project domain is assigned to that deployment.

For later live deployment, configure secrets in Vercel Environment Variables (never in frontend variables). Include the real schema JSON in the deployment and point `GRAPH_SCHEMA_PATH` to it; the ignored local `live-schema.json` is not automatically uploaded from Git. A different schema directory also needs a matching `includeFiles` setting. The function duration is configured for 120 seconds, subject to your Vercel plan. Memory-based request limiting is per function instance, not a shared global quota; use platform-level protection before exposing a paid live API publicly. Driver reuse is per warm function instance and serverless lifecycle is managed by Vercel.

Configuration references: [Vercel project configuration](https://vercel.com/docs/project-configuration/vercel-json) and [Node.js functions](https://vercel.com/docs/functions/runtimes/node-js). Local tests do not replace verification of an actual deployment.

## Stack and layout

React 19 + Vite + Tailwind CSS 4; Node.js + Express 5; TypeScript; official OpenAI and Neo4j SDKs; Zod validation; Vitest + Supertest. Manrope fonts are bundled locally, with Lucide icons. No framework for agents, second database, or authentication system.

| Location | Responsibility |
| --- | --- |
| `frontend/src/App.tsx` | Question form, examples, states, query, review, results |
| `frontend/src/style.css` | Responsive UI and Tailwind integration |
| `backend/src/config.ts` | Environment validation and live requirements |
| `backend/src/services/schema.ts` | Validated, replaceable trusted schema |
| `backend/src/services/generation.ts` | First OpenAI request |
| `backend/src/services/review.ts` | Independent second request |
| `backend/src/services/openai.ts` | Structured Outputs and SDK error handling |
| `backend/src/services/safety.ts` | Lexer, grammar parser, identifiers, types, limits |
| `backend/src/services/neo4j.ts` | Driver, EXPLAIN, reads, serialization |
| `backend/src/services/workflow.ts` | Ordered gates and common outcomes |
| `backend/src/demo/` | Fictional data and deterministic adapters |
| `backend/src/app.ts` | API routes, rate limits, errors, static frontend |
| `tests/` | Workflow, grammar, HTTP and mocked SDK tests |
| `docs/PROJECT_REPORT.md` | Architecture, viva explanation, demonstration |

## Demo mode

The mode badge, review text, and results explicitly label simulation. Demo adapters use the same service contracts and safety parser as live adapters. They make **zero OpenAI or Neo4j network calls**, and return deterministic values derived from the sample data. They do not emulate arbitrary Cypher.

Supported questions (case-insensitive, one trailing punctuation mark optional):

1. **Find in-stock headphones under INR 5000 with a rating of at least 4.** — BeatLite Air (INR 2,499), SoundWave Pro (INR 4,499), cheapest first.
2. **Show available laptops priced between INR 40000 and INR 70000.** — WorkBook 14 (INR 54,999), CreatorBook 15 (INR 68,999). Price boundaries are inclusive.
3. **Which in-stock headphones have noise cancellation?** — SoundWave Pro, QuietStudio Max, cheapest first.
4. **Show verified customer reviews for SoundWave Pro.** — two selected review excerpts, highest rating first.
5. **Find in-stock products rated at least 4.5 with 100 or more reviews.** — QuietStudio Max, CreatorBook 15, SoundWave Pro, WorkBook 14, highest rating first.

All products, prices and reviews are fictional. Prices use INR and ratings are out of 5. Product `rating` and `reviewCount` are catalog summary snapshots. The Review nodes contain selected excerpts, **not** the full review corpus, so those excerpts are not used to recalculate catalog averages. Unavailable products are excluded from the availability-based examples.

Other outcomes, under **Explore other outcomes**:

- **Find in-stock headphones under INR 500.** — successful empty result.
- **Find the best product for me.** — asks for category, budget and must-have features.
- **Demonstrate a rejected query.** — intentionally mismatched candidate, rejected by the simulated reviewer; no retrieval.

Every other question gets an unsupported response, not invented results. The demo supports the listed exact examples rather than general paraphrasing. The optional `backend/config/demo-seed.cypher` can load the same fictional product catalog into a **separate development database**. Run it manually only if desired. The app never seeds or modifies any database automatically.

## Configure live mode later

1. Copy `.env.example` to `.env`.
2. Enter the OpenAI key, Neo4j URI, username, password, and database name.
3. Create `backend/config/live-schema.json` describing the actual database, using the format below. Do **not** copy the demo schema unless your separate database really contains that sample graph.
4. Set `GRAPH_SCHEMA_PATH` and the two model names. Both models must support the Responses API and Structured Outputs and be accessible to your account.
5. Use a Neo4j account with database-enforced **read-only** permissions. Confirm permissions with the database administrator.
6. Set `APP_MODE=live` and restart. `/api/health` reports configuration readiness, **not** successful authentication, connectivity, or semantic schema accuracy. Submit a known question to verify the real integration.

No frontend or orchestration changes are needed for a different domain. The supported grammar remains deliberately narrow; some questions will need clarification or be unsupported. A live failure **never** falls back to demo results.

### Environment variables

| Variable | Default / purpose |
| --- | --- |
| `APP_MODE` | `demo`; explicit `live` enables external services |
| `OPENAI_API_KEY` | Required only in live; server secret |
| `OPENAI_GENERATION_MODEL` | `gpt-4.1-mini`; generation model, configurable |
| `OPENAI_VALIDATION_MODEL` | `gpt-4.1-mini`; independent review model, configurable |
| `NEO4J_URI` | Required in live; e.g. your `neo4j+s://...` URI |
| `NEO4J_USERNAME` | Required in live; read-only database user |
| `NEO4J_PASSWORD` | Required in live; server secret |
| `NEO4J_DATABASE` | Required in live; explicit target database |
| `GRAPH_SCHEMA_PATH` | `backend/config/live-schema.json`; relative to repository root or absolute |
| `MAX_RESULT_ROWS` | `100`; integer 1–1000 |
| `NEO4J_QUERY_TIMEOUT_MS` | `10000`; integer 100–60000, applied to planning and execution separately |
| `PORT` | `3001`; backend listening port |
| `FRONTEND_ORIGIN` | `http://127.0.0.1:5173`; development CORS origin |

Real `.env` files and the local live schema are ignored in Git. Never put credentials in `VITE_` variables, browser storage, source files, or API responses. Live requests send the English question, schema, and generated parameters to OpenAI; ensure these inputs are suitable for your intended use.

### Schema configuration format

```json
{
  "name": "Your graph",
  "nodes": [
    {
      "label": "Person",
      "description": "A person in the dataset",
      "properties": { "name": "string", "age": "number", "active": "boolean" }
    },
    {
      "label": "Team",
      "description": "A team",
      "properties": { "name": "string" }
    }
  ],
  "relationships": [
    {
      "type": "MEMBER_OF",
      "from": "Person",
      "to": "Team",
      "description": "Person belongs to Team, directed Person → Team",
      "properties": { "since": "number" }
    }
  ]
}
```

Identifiers must start with an ASCII letter and contain only letters, digits, and underscores. Node labels and relationship patterns must be unique; relationship endpoints must exist. Use `{}` for no properties. The format supports scalar string, number, and boolean properties in this first version. Relationships are directed; list each supported pattern with a useful description. Temporal database values can be displayed, but temporal filter construction is outside the initial grammar. No schema is inferred from the demo or from a model. Unknown/invalid configuration blocks live queries.

## Query pipeline and safety

1. Validate an English question (1–1000 characters, no extra request fields).
2. Load the trusted schema for the selected mode.
3. Make a Structured Outputs generation request.
4. Validate its shape, typed parameters, identifiers and conservative query grammar. Bind the row limit to `min(requested, MAX_RESULT_ROWS)` **before** review.
5. Make a fresh independent review request containing the original question, trusted schema, exact query and bound parameters. The generator's explanation is not included.
6. Proceed only on an explicit approval with no unresolved issues.
7. Run `EXPLAIN` with the same query and parameters, rejecting planning errors, non-read plans and unknown label/property/relationship warnings.
8. Execute the identical candidate in a read transaction with a timeout. Display the results directly, with **no third model request**.

SDK automatic retries are disabled; a normal successful live query uses exactly two logical OpenAI requests. There is no regeneration loop or reviewer rewrite. Non-generated outputs, refusals, incomplete responses, malformed output and missing parameters stop the pipeline.

The safety service is a **full-consumption lexer and recursive-descent allowlist parser**, not a regex keyword blacklist. Its small language supports:

- `MATCH` one labeled node or a connected chain of at most three fixed, directed, typed relationship hops; explicit labels and variables on every node.
- Optional `WHERE` comparisons between known properties and parameters, joined with `AND`/`OR`, optionally grouped with parentheses.
- Comparisons `=`, `<>`, `<`, `<=`, `>`, `>=`, `IN`, `CONTAINS`, `STARTS WITH`, `ENDS WITH`.
- `RETURN` variables, properties, or non-nested `count`, `sum`, `avg`, `min`, `max`, `toLower`, `toUpper`. `count(*)` and `count(DISTINCT variable)` are supported. Each expression needs a unique `AS` alias. `RETURN DISTINCT` is supported.
- Optional `ORDER BY` returned aliases with `ASC`/`DESC`.
- Mandatory final `LIMIT $parameter`, a dedicated positive integer parameter. Smaller requested limits are preserved; oversized limits are capped before review. The reviewer checks the original question's limit intent.

No literal filter values, quoted identifiers, comments, write/admin clauses, arbitrary procedure calls, data loads, multiple statements, disconnected patterns, variable-length traversals, `WITH`, `UNION`, subqueries, arithmetic, `SKIP`, `OPTIONAL MATCH`, nested functions, or `collect`. Schema and parameter types are checked. Dynamic parameters are typed name/value entries converted to a safe map. LIMIT is never blindly appended. The UI reports when the limit is reached, which means additional matches **may** exist; it does not claim to know the full count.

**Defense in depth:** parser restrictions reduce the surface, but are not a substitute for database authorization. Driver read routing is a routing/access-mode hint; the database account must enforce read-only permissions. `LIMIT` caps returned rows, not graph traversal or aggregation cost; database timeouts remain necessary. AI review can make mistakes and **does not guarantee correctness**. `EXPLAIN` checks syntax and planning, not intended meaning or data accuracy. The graph could change between planning and retrieval.

The application reuses a Neo4j driver, closes per-call sessions in `finally`, and closes the driver on shutdown. Results preserve columns even for zero rows. Small integers become numbers, integers outside JavaScript's safe range become decimal strings, temporal values become strings, and nodes/relationships become structured objects with element IDs and properties. Lists, nulls, and nested maps are recursive. There is no integer truncation.

## API examples

```sh
curl http://127.0.0.1:3001/api/health
curl -X POST http://127.0.0.1:3001/api/query \
  -H 'Content-Type: application/json' \
  -d '{"question":"Which in-stock headphones have noise cancellation?"}'
```

A successful response contains these fields (elapsed time varies):

```json
{
  "ok": true,
  "mode": "demo",
  "status": "success",
  "message": "Query completed.",
  "elapsedMs": 2,
  "generation": {
    "status": "generated",
    "cypher": "MATCH (c:Category)<-[:IN_CATEGORY]-(p:Product)-[:HAS_FEATURE]->(f:Feature) WHERE c.name = $category AND p.inStock = $inStock AND f.name = $feature RETURN p.name AS product, p.price AS priceINR, p.rating AS rating, p.reviewCount AS reviewCount ORDER BY priceINR ASC, product ASC LIMIT $limit",
    "parameters": [
      {
        "name": "category",
        "type": "string",
        "value": "Headphones"
      },
      {
        "name": "inStock",
        "type": "boolean",
        "value": true
      },
      {
        "name": "feature",
        "type": "string",
        "value": "Noise cancellation"
      },
      {
        "name": "limit",
        "type": "number",
        "value": 100
      }
    ],
    "explanation": "Finds in-stock headphones with noise cancellation, cheapest first.",
    "clarification": null
  },
  "candidate": {
    "cypher": "MATCH (c:Category)<-[:IN_CATEGORY]-(p:Product)-[:HAS_FEATURE]->(f:Feature) WHERE c.name = $category AND p.inStock = $inStock AND f.name = $feature RETURN p.name AS product, p.price AS priceINR, p.rating AS rating, p.reviewCount AS reviewCount ORDER BY priceINR ASC, product ASC LIMIT $limit",
    "parameters": {
      "category": "Headphones",
      "inStock": true,
      "feature": "Noise cancellation",
      "limit": 100
    },
    "limit": 100
  },
  "review": {
    "verdict": "approved",
    "explanation": "Simulated review passed for this deterministic demo example.",
    "issues": [],
    "clarification": null
  },
  "result": {
    "columns": [
      "product",
      "priceINR",
      "rating",
      "reviewCount"
    ],
    "rows": [
      [
        "SoundWave Pro",
        4499,
        4.6,
        240
      ],
      [
        "QuietStudio Max",
        7999,
        4.8,
        320
      ]
    ]
  },
  "rowCount": 2,
  "limitReached": false
}
```

`generation` is the model output; `candidate` is the finalized query and bound parameters used for review/execution. HTTP 200 can also carry `empty`, `unsupported`, `clarification_required`, or `rejected`; only successful retrieval has `ok: true`. Errors contain `ok:false`, `mode`, `status:error`, `message`, `elapsedMs`, and `error:{code,message}`; pipeline errors retain available query/review evidence. No credentials or internal stack traces are returned. Input errors use 400, restrictions 422, rate limits 429, configuration 503, upstream failures 502, and timeouts 504. Limits: 20 requests per minute per client, 16 KB JSON body. No raw-Cypher execution route exists.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Cannot reach backend | Run `npm run dev` from repository root; ensure ports 3001/5173 are free |
| Missing live configuration | Fill `.env`, set live schema path, restart backend |
| Invalid schema | Match the documented format and identifiers; ensure file exists |
| OpenAI authentication | Check server API key and project access |
| OpenAI rate limit | Check quota/billing; wait before retrying |
| Model unavailable / incomplete | Verify model access and Structured Outputs support; simplify the question |
| Query restricted | The requested structure is outside this intentionally small grammar |
| Neo4j connection failure | Verify URI, database name, network reachability, credentials, permissions |
| Planning/schema mismatch | Compare the configured schema with actual labels, properties and directions |
| Query timeout | Narrow filters; inspect database indexing and workload |
| Empty results | Query ran; verify the requested values actually exist |
| Browser copy unavailable | Select the query text and copy manually |
| Port already in use | Stop the other service; or change backend port and development proxy together |

## Verification and remaining live checks

Automated tests cover gate ordering; exact candidate identity; rejected/ambiguous/invalid outputs; unsafe syntax; missing/type-invalid parameters; limits; all demo examples and edge cases; API input/rate limiting; missing live configuration; no silent fallback; two separate mocked Responses requests; refusal/incomplete handling; mocked Neo4j planning and session closure; and serialization including large integers.

**Live integrations are implemented but not verified against external services**, because credentials and the real schema were not supplied. Model/driver tests use mocks. Once configured, manually verify a known answer, a relationship traversal, an aggregate, empty results, a smaller limit, a rejected/ambiguous request, read-only permissions, and timeout behavior against the actual graph. Compare results with a manually checked query before claiming accuracy.

Implementation references: [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses), [Neo4j JavaScript transactions](https://neo4j.com/docs/javascript-manual/current/transactions/), and [Neo4j data types](https://neo4j.com/docs/javascript-manual/current/data-types/). The implementation uses `responses.parse` with `text.format: zodTextFormat(...)`.
# MiniProject
