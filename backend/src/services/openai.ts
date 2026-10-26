import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { AppError } from "../errors.js";
export function createOpenAI(apiKey: string) {
  return new OpenAI({ apiKey, timeout: 30000, maxRetries: 0 });
}
export async function structuredRequest<T extends z.ZodType>(
  client: OpenAI,
  model: string,
  schema: T,
  name: string,
  instructions: string,
  input: unknown,
): Promise<z.infer<T>> {
  try {
    const response = await client.responses.parse({
      model,
      store: false,
      max_output_tokens: 3000,
      input: [
        { role: "system", content: instructions },
        { role: "user", content: JSON.stringify(input) },
      ],
      text: { format: zodTextFormat(schema, name) },
    });
    if (
      response.output.some(
        (item) =>
          item.type === "message" &&
          item.content.some((part) => part.type === "refusal"),
      )
    )
      throw new AppError(
        "MODEL_REFUSAL",
        "The model declined this request. Try a different question.",
      );
    if (response.status !== "completed")
      throw new AppError(
        "MODEL_INCOMPLETE",
        "The model did not finish its response. Try a shorter, more specific question.",
      );
    const parsed = schema.safeParse(response.output_parsed);
    if (!parsed.success)
      throw new AppError(
        "MODEL_INVALID",
        "The model returned an invalid structured response. Nothing was executed.",
      );
    return parsed.data;
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof OpenAI.AuthenticationError)
      throw new AppError(
        "OPENAI_AUTH",
        "OpenAI authentication failed. Check the server API key.",
        502,
      );
    if (error instanceof OpenAI.RateLimitError)
      throw new AppError(
        "OPENAI_RATE_LIMIT",
        "OpenAI quota or rate limit reached. Check billing or try later.",
        429,
      );
    if (error instanceof OpenAI.APIConnectionTimeoutError)
      throw new AppError("OPENAI_TIMEOUT", "OpenAI timed out. Try again.", 504);
    if (
      error instanceof OpenAI.APIError ||
      error instanceof OpenAI.APIConnectionError
    )
      throw new AppError(
        "OPENAI_UNAVAILABLE",
        "OpenAI could not complete the request. Check connectivity and configured model access.",
        502,
      );
    throw new AppError(
      "MODEL_INVALID",
      "The model response could not be parsed. Nothing was executed.",
      502,
    );
  }
}
