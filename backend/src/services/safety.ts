import type {
  Candidate,
  Generation,
  GraphSchema,
  ParameterValue,
} from "../contracts.js";
import { AppError } from "../errors.js";
export const RESTRICTIONS = `Only this grammar is supported: MATCH one labeled node or a single connected chain of at most 3 directed, typed relationships; optional WHERE property comparisons against parameters joined by AND/OR (parentheses allowed); RETURN expressions AS uniqueAlias; optional ORDER BY returned aliases ASC/DESC; mandatory LIMIT $parameter. Every node must have an explicit label and variable. Relationship variables are optional. Expressions are node/relationship variables, known properties, or count (including count(*) and count(DISTINCT variable)), sum, avg, min, max, toLower, toUpper. No nested functions. Only scalar string/number/boolean parameters or homogeneous string/number arrays (IN). No literals, comments, quoted identifiers, maps, subqueries, UNION, WITH, OPTIONAL MATCH, procedures, writes, loads, variable-length paths, arithmetic, SKIP, or multiple patterns/statements. Use =, <>, <, <=, >, >=, IN, CONTAINS, STARTS WITH, ENDS WITH. Respect smaller requested limits. Only request data the schema can answer; otherwise clarify or return unsupported.`;
type Type =
  | "string"
  | "number"
  | "boolean"
  | "stringList"
  | "numberList"
  | "entity";
type Token = { value: string; kind: "id" | "param" | "symbol" };
const fail = (message: string): never => {
  throw new AppError("QUERY_RESTRICTED", message);
};
// A full-consumption lexer + recursive-descent allowlist parser, not a keyword blacklist.
function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < source.length) {
    if (/\s/.test(source[i])) {
      i++;
      continue;
    }
    const rest = source.slice(i);
    const parameter = /^\$[A-Za-z][A-Za-z0-9_]*/.exec(rest);
    const identifier = /^[A-Za-z][A-Za-z0-9_]*/.exec(rest);
    const symbol = /^(->|<-|<=|>=|<>|[()\[\]:.,*=<>-])/.exec(rest);
    const match = parameter ?? identifier ?? symbol;
    if (!match)
      fail(
        "Unsupported Cypher token. Literals, comments, and extra statements are not allowed.",
      );
    tokens.push({
      value: match![0],
      kind: parameter ? "param" : identifier ? "id" : "symbol",
    });
    i += match![0].length;
  }
  return tokens;
}
export function prepareCandidate(
  generation: Generation,
  schema: GraphSchema,
  maxRows: number,
): Candidate {
  if (!generation.cypher || generation.cypher.length > 8000)
    fail("A query of at most 8,000 characters is required.");
  const params: Record<string, ParameterValue> = Object.create(null);
  const types: Record<string, Type> = Object.create(null);
  if (generation.parameters.length > 30) fail("Too many parameters.");
  for (const p of generation.parameters) {
    if (
      !/^[A-Za-z][A-Za-z0-9_]*$/.test(p.name) ||
      ["constructor", "prototype", "__proto__"].includes(p.name) ||
      Object.hasOwn(params, p.name)
    )
      fail("Invalid or duplicate parameter name.");
    const v = p.value;
    const matches =
      p.type === "stringList"
        ? Array.isArray(v) && v.every((x) => typeof x === "string")
        : p.type === "numberList"
          ? Array.isArray(v) &&
            v.every(
              (x) =>
                typeof x === "number" &&
                Number.isFinite(x) &&
                (!Number.isInteger(x) || Number.isSafeInteger(x)),
            )
          : typeof v === p.type;
    if (
      !matches ||
      (typeof v === "number" &&
        (!Number.isFinite(v) ||
          (Number.isInteger(v) && !Number.isSafeInteger(v)))) ||
      (typeof v === "string" && v.length > 2000) ||
      (Array.isArray(v) &&
        (v.length > 100 ||
          v.some((x) => typeof x === "string" && x.length > 2000)))
    )
      fail(`Invalid value for parameter ${p.name}.`);
    params[p.name] = v;
    types[p.name] = p.type;
  }
  const tokens = tokenize(generation.cypher!);
  let pos = 0;
  const peek = () => tokens[pos]?.value.toUpperCase();
  const take = (value: string) => {
    if (peek() === value) {
      pos++;
      return true;
    }
    return false;
  };
  const expect = (value: string) => {
    if (!take(value))
      fail(`Expected ${value} in the supported read-only query grammar.`);
  };
  const id = () => {
    const t = tokens[pos++];
    if (
      !t ||
      t.kind !== "id" ||
      ["constructor", "prototype", "__proto__"].includes(t.value)
    )
      return fail("Expected a safe identifier.");
    return t.value;
  };
  const used = new Set<string>();
  const parameter = () => {
    const t = tokens[pos++];
    if (!t || t.kind !== "param")
      return fail("Filter values and LIMIT must use parameters.");
    const name = t.value.slice(1);
    if (!Object.hasOwn(params, name))
      return fail(`Missing parameter: ${name}.`);
    used.add(name);
    return name;
  };
  const variables = new Map<
    string,
    {
      properties: Record<string, "string" | "number" | "boolean">;
      label?: string;
    }
  >();
  const node = () => {
    expect("(");
    const name = id();
    expect(":");
    const label = id();
    expect(")");
    const found = schema.nodes.find((n) => n.label === label);
    if (!found) fail(`Unknown node label: ${label}.`);
    const prev = variables.get(name);
    if (prev && prev.label !== label) fail("Variable label mismatch.");
    variables.set(name, { properties: found!.properties, label });
    return label;
  };
  expect("MATCH");
  let from = node();
  let hops = 0;
  while (peek() === "-" || peek() === "<-") {
    if (++hops > 3) fail("At most three relationship hops are supported.");
    const backwards = take("<-");
    if (!backwards) expect("-");
    expect("[");
    const variable = peek() !== ":" ? id() : null;
    expect(":");
    const type = id();
    expect("]");
    expect(backwards ? "-" : "->");
    const to = node();
    const rel = schema.relationships.find(
      (r) =>
        r.type === type &&
        r.from === (backwards ? to : from) &&
        r.to === (backwards ? from : to),
    );
    if (!rel)
      fail("Relationship type or direction does not match the trusted schema.");
    if (variable) {
      if (variables.has(variable))
        fail("Relationship variable must be unique.");
      variables.set(variable, { properties: rel!.properties });
    }
    from = to;
  }
  const property = (): Type => {
    const name = id();
    const variable = variables.get(name);
    if (!variable) return fail(`Unknown variable: ${name}.`);
    expect(".");
    const key = id();
    if (!Object.hasOwn(variable.properties, key))
      return fail(`Unknown property: ${key}.`);
    return variable.properties[key];
  };
  const predicate = (depth = 0): void => {
    if (depth > 12) fail("Filter nesting is too deep.");
    if (take("(")) {
      booleanExpression(depth + 1);
      expect(")");
      return;
    }
    const type = property();
    let operator = tokens[pos++]?.value.toUpperCase();
    if (operator === "STARTS" || operator === "ENDS") {
      expect("WITH");
      operator += " WITH";
    }
    if (
      ![
        "=",
        "<>",
        "<",
        "<=",
        ">",
        ">=",
        "IN",
        "CONTAINS",
        "STARTS WITH",
        "ENDS WITH",
      ].includes(operator ?? "")
    )
      fail("Unsupported comparison operator.");
    const name = parameter();
    const expected = operator === "IN" ? `${type}List` : type;
    if (types[name] !== expected)
      fail(`Parameter ${name} does not match the property type.`);
    if (
      ["CONTAINS", "STARTS WITH", "ENDS WITH"].includes(operator!) &&
      type !== "string"
    )
      fail("Text comparison requires a string property.");
  };
  const booleanExpression = (depth = 0) => {
    predicate(depth);
    while (take("AND") || take("OR")) predicate(depth);
  };
  if (take("WHERE")) booleanExpression();
  expect("RETURN");
  take("DISTINCT");
  const expression = (): Type => {
    const name = tokens[pos]?.value;
    if (tokens[pos + 1]?.value === "(") {
      const fn = id().toLowerCase();
      if (
        !["count", "sum", "avg", "min", "max", "tolower", "toupper"].includes(
          fn,
        )
      )
        return fail("Unsupported function.");
      expect("(");
      const distinct = take("DISTINCT");
      if (distinct && fn !== "count")
        fail("DISTINCT is supported only in count().");
      let type: Type;
      if (take("*")) {
        if (fn !== "count" || distinct)
          fail("Only count(*) supports a wildcard.");
        type = "entity";
      } else if (tokens[pos + 1]?.value === ".") type = property();
      else {
        if (!variables.has(id())) fail("Unknown function argument.");
        type = "entity";
      }
      expect(")");
      if (["sum", "avg"].includes(fn) && type !== "number")
        fail("Numeric aggregate requires a number property.");
      if (["tolower", "toupper"].includes(fn) && type !== "string")
        fail("Text function requires a string property.");
      if (["min", "max"].includes(fn) && type === "entity")
        fail("Min/max requires a scalar property.");
      return ["count", "sum", "avg"].includes(fn) ? "number" : type;
    }
    if (tokens[pos + 1]?.value === ".") return property();
    if (!name || !variables.has(id()))
      return fail("Unknown return expression.");
    return "entity";
  };
  const aliases = new Set<string>();
  do {
    expression();
    expect("AS");
    const alias = id();
    if (aliases.has(alias)) fail("Duplicate return alias.");
    aliases.add(alias);
    if (aliases.size > 20) fail("Too many result columns.");
  } while (take(","));
  if (take("ORDER")) {
    expect("BY");
    do {
      if (!aliases.has(id())) fail("ORDER BY must reference a returned alias.");
      if (!take("ASC")) take("DESC");
    } while (take(","));
  }
  expect("LIMIT");
  const limitName = parameter();
  if (pos !== tokens.length)
    fail("Additional clauses or statements are not supported.");
  if (
    tokens.filter((t) => t.kind === "param" && t.value === `$${limitName}`)
      .length !== 1
  )
    fail("LIMIT needs its own dedicated parameter.");
  const requested = params[limitName];
  if (
    typeof requested !== "number" ||
    !Number.isSafeInteger(requested) ||
    requested < 1
  )
    fail("LIMIT must be a positive integer.");
  for (const name of Object.keys(params))
    if (!used.has(name)) fail(`Unused parameter: ${name}.`);
  params[limitName] = Math.min(requested as number, maxRows);
  return {
    cypher: generation.cypher!,
    parameters: params,
    limit: params[limitName] as number,
  };
}
