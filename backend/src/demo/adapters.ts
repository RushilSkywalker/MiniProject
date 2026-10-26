import type {
  Candidate,
  Database,
  Generation,
  Generator,
  Result,
  Reviewer,
} from "../contracts.js";
import { AppError } from "../errors.js";
import { products, reviews, examples, specialExamples } from "./fixtures.js";
const normalize = (q: string) =>
  q
    .trim()
    .replace(/[?.!]$/, "")
    .toLowerCase();
const entry = (
  name: string,
  value: string | number | boolean,
): Generation["parameters"][number] => ({
  name,
  type: typeof value as "string" | "number" | "boolean",
  value,
});
const columns = ["product", "priceINR", "rating", "reviewCount"];
const projection =
  "p.name AS product, p.price AS priceINR, p.rating AS rating, p.reviewCount AS reviewCount";
const templates = [
  {
    question: examples[0],
    cypher: `MATCH (p:Product)-[:IN_CATEGORY]->(c:Category) WHERE c.name = $category AND p.inStock = $inStock AND p.price < $maxPrice AND p.rating >= $minRating RETURN ${projection} ORDER BY priceINR ASC, product ASC LIMIT $limit`,
    parameters: [
      entry("category", "Headphones"),
      entry("inStock", true),
      entry("maxPrice", 5000),
      entry("minRating", 4),
    ],
    explanation:
      "Finds available headphones below INR 5,000 with a catalog rating of at least 4/5, cheapest first.",
  },
  {
    question: examples[1],
    cypher: `MATCH (p:Product)-[:IN_CATEGORY]->(c:Category) WHERE c.name = $category AND p.inStock = $inStock AND p.price >= $minPrice AND p.price <= $maxPrice RETURN ${projection} ORDER BY priceINR ASC, product ASC LIMIT $limit`,
    parameters: [
      entry("category", "Laptops"),
      entry("inStock", true),
      entry("minPrice", 40000),
      entry("maxPrice", 70000),
    ],
    explanation:
      "Finds available laptops within the inclusive INR 40,000–70,000 range, cheapest first.",
  },
  {
    question: examples[2],
    cypher: `MATCH (c:Category)<-[:IN_CATEGORY]-(p:Product)-[:HAS_FEATURE]->(f:Feature) WHERE c.name = $category AND p.inStock = $inStock AND f.name = $feature RETURN ${projection} ORDER BY priceINR ASC, product ASC LIMIT $limit`,
    parameters: [
      entry("category", "Headphones"),
      entry("inStock", true),
      entry("feature", "Noise cancellation"),
    ],
    explanation:
      "Finds in-stock headphones with noise cancellation, cheapest first.",
  },
  {
    question: examples[3],
    cypher:
      "MATCH (p:Product)-[:HAS_REVIEW]->(r:Review) WHERE p.name = $product AND r.verifiedPurchase = $verified RETURN r.title AS title, r.rating AS rating, r.text AS review, r.verifiedPurchase AS verifiedPurchase ORDER BY rating DESC, title ASC LIMIT $limit",
    parameters: [entry("product", "SoundWave Pro"), entry("verified", true)],
    explanation:
      "Shows selected verified-purchase review excerpts for SoundWave Pro, highest ratings first. These are fictional samples, not the complete review corpus.",
  },
  {
    question: examples[4],
    cypher: `MATCH (p:Product) WHERE p.inStock = $inStock AND p.rating >= $minRating AND p.reviewCount >= $minReviews RETURN ${projection} ORDER BY rating DESC, product ASC LIMIT $limit`,
    parameters: [
      entry("inStock", true),
      entry("minRating", 4.5),
      entry("minReviews", 100),
    ],
    explanation:
      "Finds available products with catalog ratings of at least 4.5/5 and at least 100 reviews, highest ratings first.",
  },
];
export function demoAdapters(): {
  generator: Generator;
  reviewer: Reviewer;
  database: Database;
} {
  // Each request gets its own adapters and selected fixture.
  let selected = -1;
  let empty = false;
  let reject = false;
  return {
    generator: {
      async generate(question, _schema, maxRows) {
        selected = templates.findIndex(
          (t) => normalize(t.question) === normalize(question),
        );
        empty = normalize(question) === normalize(specialExamples[0]);
        reject = normalize(question) === normalize(specialExamples[2]);
        if (empty || reject) selected = 0;
        if (normalize(question) === normalize(specialExamples[1]))
          return {
            status: "clarification_required",
            cypher: null,
            parameters: [],
            explanation:
              "“Best” depends on your budget, preferred category, and required features.",
            clarification:
              "What product category, price range in INR, and must-have features are you looking for?",
          } satisfies Generation;
        if (selected < 0)
          return {
            status: "unsupported",
            cypher: null,
            parameters: [],
            explanation:
              "Demo mode supports only the listed shopping questions. Choose an example, or configure live mode for other product requirements.",
            clarification: null,
          } satisfies Generation;
        const template = templates[selected];
        // The empty example has no rating requirement, so remove that filter before review.
        const cypher = empty
          ? template.cypher.replace(" AND p.rating >= $minRating", "")
          : template.cypher;
        const parameters = template.parameters
          .filter((p) => !empty || p.name !== "minRating")
          .map((p) =>
            empty && p.name === "maxPrice" ? entry("maxPrice", 500) : { ...p },
          );
        return {
          status: "generated",
          cypher,
          parameters: [...parameters, entry("limit", maxRows)],
          explanation: empty
            ? "Finds in-stock headphones below INR 500. The sample catalog has no matching products."
            : template.explanation,
          clarification: null,
        } satisfies Generation;
      },
    },
    reviewer: {
      async review() {
        return reject
          ? {
              verdict: "rejected",
              explanation:
                "Simulated rejection: the candidate searches headphones instead of answering the demonstration request.",
              issues: ["The query does not answer the original question."],
              clarification: null,
            }
          : {
              verdict: "approved",
              explanation:
                "Simulated review passed for this deterministic demo example.",
              issues: [],
              clarification: null,
            };
      },
    },
    database: {
      async explain(candidate) {
        const expected = empty
          ? templates[0].cypher.replace(" AND p.rating >= $minRating", "")
          : templates[selected]?.cypher;
        if (candidate.cypher !== expected)
          throw new AppError("DEMO_QUERY", "This query has no demo fixture.");
      },
      async execute(candidate: Candidate): Promise<Result> {
        const p = candidate.parameters;
        if (selected === 3) {
          const product = products.find(
            (product) => product.name === p.product,
          );
          const matching = reviews
            .filter(
              (r) =>
                r.productId === product?.id &&
                r.verifiedPurchase === p.verified,
            )
            .sort(
              (a, b) => b.rating - a.rating || a.title.localeCompare(b.title),
            );
          return {
            columns: ["title", "rating", "review", "verifiedPurchase"],
            rows: matching
              .slice(0, candidate.limit)
              .map((r) => [r.title, r.rating, r.text, r.verifiedPurchase]),
          };
        }
        const matching = products
          .filter((product) => {
            if (product.inStock !== p.inStock) return false;
            if (selected !== 4 && product.category !== p.category) return false;
            if (selected === 0)
              return (
                product.price < Number(p.maxPrice) &&
                (empty || product.rating >= Number(p.minRating))
              );
            if (selected === 1)
              return (
                product.price >= Number(p.minPrice) &&
                product.price <= Number(p.maxPrice)
              );
            if (selected === 2)
              return product.features.includes(String(p.feature));
            return (
              product.rating >= Number(p.minRating) &&
              product.reviewCount >= Number(p.minReviews)
            );
          })
          .sort(
            (a, b) =>
              (selected === 4 ? b.rating - a.rating : a.price - b.price) ||
              a.name.localeCompare(b.name),
          );
        return {
          columns,
          rows: matching
            .slice(0, candidate.limit)
            .map((product) => [
              product.name,
              product.price,
              product.rating,
              product.reviewCount,
            ]),
        };
      },
    },
  };
}
