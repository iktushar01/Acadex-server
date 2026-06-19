import axios from "axios";
import { StatusCodes } from "http-status-codes";
import { envVars } from "../../../config/env";
import AppError from "../../errorHelpers/AppError";

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
  const response = await axios.post(
    `${envVars.OPENROUTER_BASE_URL}/embeddings`,
    {
      model: envVars.OPENROUTER_EMBEDDING_MODEL,
      input,
    },
    { headers: getHeaders(), timeout: 60_000 },
  );

  const embedding = response.data?.data?.[0]?.embedding;

  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new AppError(
      StatusCodes.BAD_GATEWAY,
      "Failed to generate embedding from OpenRouter",
    );
  }

  return embedding;
};

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const chatCompletion = async (
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number },
): Promise<string> => {
  const response = await axios.post(
    `${envVars.OPENROUTER_BASE_URL}/chat/completions`,
    {
      model: envVars.OPENROUTER_LLM_MODEL,
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

export const OpenRouterClient = {
  embedText,
  chatCompletion,
};
