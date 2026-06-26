import dotenv from "dotenv";
import { StatusCodes } from "http-status-codes";
import { SignOptions } from "jsonwebtoken";

import AppError from "../app/errorHelpers/AppError";
dotenv.config()


interface EnvConfig {
    PORT: string;
    NODE_ENV: string;
    BETTER_AUTH_URL: string;
    FRONTEND_URL: string;
    DATABASE_URL: string;
    BETTER_AUTH_SECRET: string;
    ACCESS_TOKEN_SECRET: string;
    REFRESH_TOKEN_SECRET: string;
    ACCESS_TOKEN_EXPIRES_IN: SignOptions['expiresIn'];
    REFRESH_TOKEN_EXPIRES_IN: SignOptions['expiresIn'];
    BETTER_AUTH_SESSION_TOKEN_EXPIRES_IN: SignOptions['expiresIn'];
    BETTER_AUTH_SESSION_TOKEN_UPDATE_AGE: SignOptions['expiresIn'];
    EMAIL_HOST: string;
    EMAIL_PORT: number;
    EMAIL_SECURE: boolean;
    EMAIL_USER: string;
    EMAIL_PASSWORD: string;
    EMAIL_FROM: string;
    EXPIRE_OTP_TIME: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    GOOGLE_CALLBACK_URL: string;
    CLOUDINARY_CLOUD_NAME: string;
    CLOUDINARY_API_KEY: string;
    CLOUDINARY_API_SECRET: string;
    IMGBB_API_KEY: string;
    SUPER_ADMIN_EMAIL: string;
    SUPER_ADMIN_PASSWORD: string;
    OPENROUTER_API_KEY: string | undefined;
    OPENROUTER_BASE_URL: string;
    OPENROUTER_EMBEDDING_MODEL: string;
    OPENROUTER_LLM_MODEL: string;
    OPENROUTER_LLM_MODEL_FAST: string;
    OPENROUTER_LLM_MODEL_POWER: string;
    OPENROUTER_VISION_MODEL: string;
    CHATBOT_TOP_K: number;
    CHATBOT_MIN_SIMILARITY: number;
    CHATBOT_EMBEDDING_DIMENSION: number;
    CHATBOT_EMBED_BATCH_SIZE: number;
    CHATBOT_HISTORY_LIMIT: number;
    CHATBOT_RATE_LIMIT_MAX: number;
    CHATBOT_RATE_LIMIT_WINDOW_MS: number;
    STRIPE_SECRET_KEY: string | undefined;
    STRIPE_WEBHOOK_SECRET: string | undefined;
}

const requiredEnvVariables = [
    "PORT",
    "NODE_ENV",
    "BETTER_AUTH_URL",
    "FRONTEND_URL",
    "DATABASE_URL",
    "BETTER_AUTH_SECRET",
    "ACCESS_TOKEN_SECRET",
    "REFRESH_TOKEN_SECRET",
    "ACCESS_TOKEN_EXPIRES_IN",
    "REFRESH_TOKEN_EXPIRES_IN",
    "BETTER_AUTH_SESSION_TOKEN_EXPIRES_IN",
    "BETTER_AUTH_SESSION_TOKEN_UPDATE_AGE",
    "EMAIL_HOST",
    "EMAIL_PORT",
    "EMAIL_SECURE",
    "EMAIL_USER",
    "EMAIL_PASSWORD",
    "EMAIL_FROM",
    "EXPIRE_OTP_TIME",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_CALLBACK_URL",
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
    "IMGBB_API_KEY",
    "SUPER_ADMIN_EMAIL",
    "SUPER_ADMIN_PASSWORD",
];


requiredEnvVariables.forEach((variable) => {
    if (!process.env[variable]) {
        throw new AppError(StatusCodes.INTERNAL_SERVER_ERROR, `Environment variable ${variable} is not defined`);
    }
});

const loadEnvVariables = (): EnvConfig => {
    return {
        PORT: process.env.PORT as string,
        NODE_ENV: process.env.NODE_ENV as string,
        BETTER_AUTH_URL: process.env.BETTER_AUTH_URL as string,
        FRONTEND_URL: process.env.FRONTEND_URL as string,
        DATABASE_URL: process.env.DATABASE_URL as string,
        BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET as string,
        ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET as string,
        REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET as string,
        ACCESS_TOKEN_EXPIRES_IN: process.env.ACCESS_TOKEN_EXPIRES_IN as SignOptions['expiresIn'],
        REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN as SignOptions['expiresIn'],
        BETTER_AUTH_SESSION_TOKEN_EXPIRES_IN: process.env.BETTER_AUTH_SESSION_TOKEN_EXPIRES_IN as SignOptions['expiresIn'],
        BETTER_AUTH_SESSION_TOKEN_UPDATE_AGE: process.env.BETTER_AUTH_SESSION_TOKEN_UPDATE_AGE as SignOptions['expiresIn'],
        EMAIL_HOST: process.env.EMAIL_HOST as string,
        EMAIL_PORT: Number(process.env.EMAIL_PORT),
        EMAIL_SECURE: process.env.EMAIL_SECURE === 'true',
        EMAIL_USER: process.env.EMAIL_USER as string,
        EMAIL_PASSWORD: process.env.EMAIL_PASSWORD as string,
        EMAIL_FROM: process.env.EMAIL_FROM as string,
        EXPIRE_OTP_TIME: process.env.EXPIRE_OTP_TIME as string,
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID as string,
        GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET as string,
        GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL as string,
        CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME as string,
        CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY as string,
        CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET as string,
        IMGBB_API_KEY: process.env.IMGBB_API_KEY as string,
        SUPER_ADMIN_EMAIL: process.env.SUPER_ADMIN_EMAIL as string,
        SUPER_ADMIN_PASSWORD: process.env.SUPER_ADMIN_PASSWORD as string,
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
        OPENROUTER_BASE_URL:
            process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
        OPENROUTER_EMBEDDING_MODEL:
            process.env.OPENROUTER_EMBEDDING_MODEL ??
            "nvidia/llama-nemotron-embed-vl-1b-v2:free",
        OPENROUTER_LLM_MODEL:
            process.env.OPENROUTER_LLM_MODEL ??
            "nvidia/nemotron-3-super-120b-a12b:free",
        OPENROUTER_LLM_MODEL_FAST:
            process.env.OPENROUTER_LLM_MODEL_FAST ??
            process.env.OPENROUTER_LLM_MODEL ??
            "nvidia/nemotron-3-super-120b-a12b:free",
        OPENROUTER_LLM_MODEL_POWER:
            process.env.OPENROUTER_LLM_MODEL_POWER ??
            process.env.OPENROUTER_LLM_MODEL ??
            "nvidia/nemotron-3-super-120b-a12b:free",
        OPENROUTER_VISION_MODEL:
            process.env.OPENROUTER_VISION_MODEL ??
            "google/gemini-2.0-flash-lite-preview-02-05:free",
        CHATBOT_TOP_K: Number(process.env.CHATBOT_TOP_K ?? 8),
        CHATBOT_MIN_SIMILARITY: Number(process.env.CHATBOT_MIN_SIMILARITY ?? 0.5),
        CHATBOT_EMBEDDING_DIMENSION: Number(
            process.env.CHATBOT_EMBEDDING_DIMENSION ?? 2048,
        ),
        CHATBOT_EMBED_BATCH_SIZE: Number(process.env.CHATBOT_EMBED_BATCH_SIZE ?? 16),
        CHATBOT_HISTORY_LIMIT: Number(process.env.CHATBOT_HISTORY_LIMIT ?? 10),
        CHATBOT_RATE_LIMIT_MAX: Number(process.env.CHATBOT_RATE_LIMIT_MAX ?? 25),
        CHATBOT_RATE_LIMIT_WINDOW_MS: Number(
            process.env.CHATBOT_RATE_LIMIT_WINDOW_MS ?? 60_000,
        ),
        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
        STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    }
}

export const envVars: EnvConfig = loadEnvVariables();