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
    }
}

export const envVars: EnvConfig = loadEnvVariables();