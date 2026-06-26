import axios from "axios";
import { StatusCodes } from "http-status-codes";
import { envVars } from "../../../config/env";
import AppError from "../../errorHelpers/AppError";
import {
  getCachedEmbedding,
  setCachedEmbedding,
} from "./chatbot.embedding-cache";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
};

type ChatOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

const getHeaders = () => {
  if (!envVars.OPENROUTER_API_KEY) {
    throw new AppError(
      StatusCodes.SERVICE_UNAVAILABLE,
      "AI assistant is not configured. Missing OPENROUTER_API_KEY.",
    );
  }

  return {
    Authorization: `Bearer ${envVars.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
    "HTTP-Referer": envVars.FRONTEND_URL,
    "X-Title": "Acadex Study Assistant",
  };
};

const embedText = async (input: string): Promise<number[]> => {
  const cached = getCachedEmbedding(input);
  if (cached) return cached;

  const [embedding] = await embedTexts([input]);
  if (!embedding) {
    throw new AppError(
      StatusCodes.BAD_GATEWAY,
      "Failed to generate embedding from OpenRouter",
    );
  }
  setCachedEmbedding(input, embedding);
  return embedding;
};

const embedTexts = async (inputs: string[]): Promise<number[][]> => {
  if (inputs.length === 0) return [];

  const uncached: { index: number; text: string }[] = [];
  const results: number[][] = new Array(inputs.length);

  inputs.forEach((text, index) => {
    const cached = getCachedEmbedding(text);
    if (cached) {
      results[index] = cached;
    } else {
      uncached.push({ index, text });
    }
  });

  if (uncached.length === 0) {
    return results as number[][];
  }

  const batchSize = envVars.CHATBOT_EMBED_BATCH_SIZE;

  for (let offset = 0; offset < uncached.length; offset += batchSize) {
    const batch = uncached.slice(offset, offset + batchSize);
    const response = await axios.post(
      `${envVars.OPENROUTER_BASE_URL}/embeddings`,
      {
        model: envVars.OPENROUTER_EMBEDDING_MODEL,
        input: batch.map((entry) => entry.text),
      },
      { headers: getHeaders(), timeout: 120_000 },
    );

    const data = response.data?.data;
    if (!Array.isArray(data)) {
      throw new AppError(
        StatusCodes.BAD_GATEWAY,
        "Failed to generate embeddings from OpenRouter",
      );
    }

    data.forEach((item: { embedding?: number[]; index?: number }, i: number) => {
      const embedding = item?.embedding;
      const targetIndex = batch[i]?.index ?? item?.index ?? i;

      if (!Array.isArray(embedding) || embedding.length === 0) {
        throw new AppError(
          StatusCodes.BAD_GATEWAY,
          "Failed to generate embedding from OpenRouter",
        );
      }

      results[targetIndex] = embedding;
      setCachedEmbedding(batch[i]!.text, embedding);
    });
  }

  return results as number[][];
};

const chatCompletion = async (
  messages: ChatMessage[],
  options?: ChatOptions,
): Promise<string> => {
  const response = await axios.post(
    `${envVars.OPENROUTER_BASE_URL}/chat/completions`,
    {
      model: options?.model ?? envVars.OPENROUTER_LLM_MODEL,
      messages,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 1024,
    },
    { headers: getHeaders(), timeout: 90_000 },
  );

  const content = response.data?.choices?.[0]?.message?.content;

  if (!content || typeof content !== "string") {
    throw new AppError(
      StatusCodes.BAD_GATEWAY,
      "Failed to generate a response from OpenRouter",
    );
  }

  return content.trim();
};

const chatCompletionStream = async function* (
  messages: ChatMessage[],
  options?: ChatOptions,
): AsyncGenerator<string> {
  const response = await axios.post(
    `${envVars.OPENROUTER_BASE_URL}/chat/completions`,
    {
      model: options?.model ?? envVars.OPENROUTER_LLM_MODEL,
      messages,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 1500,
      stream: true,
    },
    {
      headers: getHeaders(),
      timeout: 120_000,
      responseType: "stream",
    },
  );

  let buffer = "";

  for await (const chunk of response.data as AsyncIterable<Buffer>) {
    buffer += chunk.toString("utf8");
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;

      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;

      try {
        const parsed = JSON.parse(payload);
        const delta = parsed?.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta.length > 0) {
          yield delta;
        }
      } catch {
        // skip malformed SSE chunks
      }
    }
  }
};

const describeImage = async (imageUrl: string): Promise<string> => {
  const content = await chatCompletion(
    [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract all readable text, formulas, labels, and diagram descriptions from this academic note image. Output plain searchable study text. Preserve mathematical notation.",
          },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
    {
      model: envVars.OPENROUTER_VISION_MODEL,
      temperature: 0.1,
      maxTokens: 2000,
    },
  );

  return content.trim();
};

export const OpenRouterClient = {
  embedText,
  embedTexts,
  chatCompletion,
  chatCompletionStream,
  describeImage,
};

export type { ChatMessage };
