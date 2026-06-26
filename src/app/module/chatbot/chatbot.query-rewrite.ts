import { envVars } from "../../../config/env";
import { OpenRouterClient } from "./openrouter.client";
import { ChatbotMode } from "./chatbot.interface";

export const rewriteQueryForRetrieval = async (
  message: string,
  mode: ChatbotMode,
): Promise<string> => {
  const trimmed = message.trim();
  if (trimmed.length < 8) return trimmed;

  try {
    const rewritten = await OpenRouterClient.chatCompletion(
      [
        {
          role: "system",
          content:
            "Rewrite the student question into a detailed search query for classroom notes retrieval. Keep it factual, include subject terms, and output ONLY the rewritten query (one sentence).",
        },
        {
          role: "user",
          content: `Mode: ${mode}\nQuestion: ${trimmed}`,
        },
      ],
      {
        model: envVars.OPENROUTER_LLM_MODEL_FAST,
        temperature: 0.1,
        maxTokens: 120,
      },
    );

    return rewritten.trim() || trimmed;
  } catch {
    return trimmed;
  }
};
