import { Response } from "express";
import { envVars } from "../../config/env";
import { cookieUtils } from "./cookies";
import { jwtUtils } from "./jwt";
import { JwtPayload } from "jsonwebtoken";
import ms, { StringValue } from 'ms';

const getAccessToken = (payload: JwtPayload) => {
    const accessToken = jwtUtils.createToken(payload, envVars.ACCESS_TOKEN_SECRET, {
        ...(envVars.ACCESS_TOKEN_EXPIRES_IN !== undefined
            ? { expiresIn: envVars.ACCESS_TOKEN_EXPIRES_IN }
            : {}),
    });
    return accessToken;
}

const getRefreshToken = (payload: JwtPayload) => {
    const refreshToken = jwtUtils.createToken(payload, envVars.REFRESH_TOKEN_SECRET, {
        ...(envVars.REFRESH_TOKEN_EXPIRES_IN !== undefined
            ? { expiresIn: envVars.REFRESH_TOKEN_EXPIRES_IN }
            : {}),
    });
    return refreshToken;
}

const getAccessTokenFromCookie = (res: Response, token: string) => {
    const maxAge = ms(envVars.ACCESS_TOKEN_EXPIRES_IN as StringValue);
    const isProd = envVars.NODE_ENV === "production";
    cookieUtils.setCookie(res, 'accessToken', token, {
        httpOnly: true,
        secure: isProd,
        // `sameSite: "none"` requires `secure`, so relax it in dev.
        sameSite: isProd ? 'none' : 'lax',
        path: '/',
        maxAge: maxAge
    });
}

const getRefreshTokenFromCookie = (res: Response, token: string) => {
    const maxAge = ms(envVars.REFRESH_TOKEN_EXPIRES_IN as StringValue);
    const isProd = envVars.NODE_ENV === "production";
    cookieUtils.setCookie(res, 'refreshToken', token, {
        httpOnly: true,
        secure: isProd,
        // `sameSite: "none"` requires `secure`, so relax it in dev.
        sameSite: isProd ? 'none' : 'lax',
        path: '/',
        maxAge: maxAge
    });
}

const getBetterAuthAccessToken = (res: Response, token: string) => {
    const maxAge = ms(envVars.ACCESS_TOKEN_EXPIRES_IN as StringValue);
    const isProd = envVars.NODE_ENV === "production";
    cookieUtils.setCookie(res, 'better-auth.session_token', token, {
        httpOnly: true,
        secure: isProd,
        // `sameSite: "none"` requires `secure`, so relax it in dev.
        sameSite: isProd ? 'none' : 'lax',
        path: '/',
        maxAge: maxAge
    });
}

export const tokenUtils = {
    getAccessToken,
    getRefreshToken,
    getAccessTokenFromCookie,
    getRefreshTokenFromCookie,
    getBetterAuthAccessToken
}
