import { StatusCodes } from "http-status-codes";
import { envVars } from "../../../config/env";
import AppError from "../../errorHelpers/AppError";

const windows = new Map<string, number[]>();

export const checkChatbotRateLimit = (userId: string): void => {
  const now = Date.now();
  const windowMs = envVars.CHATBOT_RATE_LIMIT_WINDOW_MS;
  const maxRequests = envVars.CHATBOT_RATE_LIMIT_MAX;

  const timestamps = (windows.get(userId) ?? []).filter(
    (timestamp) => now - timestamp < windowMs,
  );

  if (timestamps.length >= maxRequests) {
    throw new AppError(
      StatusCodes.TOO_MANY_REQUESTS,
      "Too many study assistant requests. Please wait a moment and try again.",
    );
  }

  timestamps.push(now);
  windows.set(userId, timestamps);
};
