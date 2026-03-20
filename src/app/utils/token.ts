import { Response } from "express";
import { envVars } from "../../config/env";
import { cookieUtils } from "./cookies";
import { jwtUtils } from "./jwt";
import { JwtPayload } from "jsonwebtoken";
import ms, { StringValue } from 'ms';

const getAccessToken = (payload: JwtPayload) => {
    const accessToken = jwtUtils.createToken(payload, envVars.ACCESS_TOKEN_SECRET, { expiresIn: envVars.ACCESS_TOKEN_EXPIRES_IN });
    return accessToken;
}

const getRefreshToken = (payload: JwtPayload) => {
    const refreshToken = jwtUtils.createToken(payload, envVars.REFRESH_TOKEN_SECRET, { expiresIn: envVars.REFRESH_TOKEN_EXPIRES_IN });
    return refreshToken;
}

const getAccessTokenFromCookie = (res: Response, token: string) => {
    const maxAge = ms(envVars.ACCESS_TOKEN_EXPIRES_IN as StringValue);
    cookieUtils.setCookie(res, 'accessToken', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
        maxAge: maxAge
    });
}

const getRefreshTokenFromCookie = (res: Response, token: string) => {
    const maxAge = ms(envVars.REFRESH_TOKEN_EXPIRES_IN as StringValue);
    cookieUtils.setCookie(res, 'refreshToken', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
        maxAge: maxAge
    });
}

const getBetterAuthAccessToken = (res: Response, token: string) => {
    const maxAge = ms(envVars.ACCESS_TOKEN_EXPIRES_IN as StringValue);
    cookieUtils.setCookie(res, 'better-auth.session_token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
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
