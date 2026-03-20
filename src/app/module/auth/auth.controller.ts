import { envVars } from "../../../config/env";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { tokenUtils } from "../../utils/token";
import { AuthService } from "./auth.service";
import { StatusCodes } from "http-status-codes";
import ms, { StringValue } from "ms";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "./auth.interface";
import { Request, Response } from "express";
import { cookieUtils } from "../../utils/cookies";
import { auth } from "../../lib/auth";


const registerStudent = catchAsync(async (req, res) => {
    const { name, email, password } = req.body;

    const result = await AuthService.registerStudent({ name, email, password });

    const { accessToken, refreshToken, token, ...rest } = result;

    res.cookie("better-auth.session_token", token, {
        httpOnly: true,
        secure: envVars.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: ms(envVars.BETTER_AUTH_SESSION_TOKEN_EXPIRES_IN as StringValue),
    });

    tokenUtils.getAccessTokenFromCookie(res, accessToken ?? '');
    tokenUtils.getRefreshTokenFromCookie(res, refreshToken ?? '');
    tokenUtils.getBetterAuthAccessToken(res, token ?? '');

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Student registered successfully",
        data: {
            ...rest,
            accessToken,
            refreshToken,
            token
        }
    })
})

const loginUser = catchAsync(async (req, res) => {
    const { email, password } = req.body;
    const result = await AuthService.loginUser({ email, password });
    const { accessToken, refreshToken, token, ...rest } = result;

    tokenUtils.getAccessTokenFromCookie(res, accessToken ?? '');
    tokenUtils.getRefreshTokenFromCookie(res, refreshToken ?? '');
    tokenUtils.getBetterAuthAccessToken(res, token ?? '');

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "User logged in successfully",
        data: {
            ...rest,
            accessToken,
            refreshToken,
            token
        }
    })
})

const getMe = catchAsync(async (req, res) => {
    const user = req.user as IRequestUser;
    const result = await AuthService.getMe(user);
    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "User fetched successfully",
        data: result,
    })
})

const getNewTokens = catchAsync(async (req, res) => {
    const oldRefreshToken = req.cookies.refreshToken;
    const sessionToken = req.cookies["better-auth.session_token"];

    if (!oldRefreshToken || !sessionToken) {
        throw new AppError(StatusCodes.UNAUTHORIZED, "Refresh token or session token not found");
    }

    const result = await AuthService.getNewTokens(oldRefreshToken, sessionToken);
    const { accessToken, refreshToken, updatedToken } = result;

    tokenUtils.getAccessTokenFromCookie(res, accessToken);
    tokenUtils.getRefreshTokenFromCookie(res, refreshToken);
    tokenUtils.getBetterAuthAccessToken(res, updatedToken);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Tokens fetched successfully",
        data: {
            accessToken,
            refreshToken,
            updatedToken
        }
    })
})


const changePassword = catchAsync(
    async (req: Request, res: Response) => {
        const payload = req.body;
        const betterAuthSessionToken = req.cookies["better-auth.session_token"];

        const result = await AuthService.changePassword(payload, betterAuthSessionToken);

        const { accessToken, refreshToken, token } = result;

        tokenUtils.getAccessTokenFromCookie(res, accessToken);
        tokenUtils.getRefreshTokenFromCookie(res, refreshToken);
        tokenUtils.getBetterAuthAccessToken(res, token as string);

        sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: "Password changed successfully",
            data: result,
        });
    }
)


const logoutUser = catchAsync(
    async (req: Request, res: Response) => {
        const betterAuthSessionToken = req.cookies["better-auth.session_token"];
        const result = await AuthService.logoutUser(betterAuthSessionToken);
        cookieUtils.clearCookie(res, 'accessToken', {
            httpOnly: true,
            secure: true,
            sameSite: "none",
        });
        cookieUtils.clearCookie(res, 'refreshToken', {
            httpOnly: true,
            secure: true,
            sameSite: "none",
        });
        cookieUtils.clearCookie(res, 'better-auth.session_token', {
            httpOnly: true,
            secure: true,
            sameSite: "none",
        });

        sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: "User logged out successfully",
            data: result,
        });
    }
)

const verifyEmail = catchAsync(
    async (req: Request, res: Response) => {
        const { email, otp } = req.body;
        await AuthService.verifyEmail(email, otp);

        sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: "Email verified successfully",
        });
    }
)

const forgetPassword = catchAsync(
    async (req: Request, res: Response) => {
        const { email } = req.body;
        await AuthService.forgetPassword(email);

        sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: "Password reset OTP sent to email successfully",
        });
    }
)

const resetPassword = catchAsync(
    async (req: Request, res: Response) => {
        const { email, otp, newPassword } = req.body;
        await AuthService.resetPassword(email, otp, newPassword);

        sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: "Password reset successfully",
        });
    }
)

const googleLogin = catchAsync((req: Request, res: Response) => {
    const redirectPath = req.query.redirect || "/dashboard";

    const encodedRedirectPath = encodeURIComponent(redirectPath as string);

    const callbackURL = `${envVars.BETTER_AUTH_URL}/api/v1/auth/google/success?redirect=${encodedRedirectPath}`;

    res.render("googleRedirect", {
        callbackURL: callbackURL,
        betterAuthUrl: envVars.BETTER_AUTH_URL,
    })
})

const googleLoginSuccess = catchAsync(async (req: Request, res: Response) => {
    const redirectPath = req.query.redirect as string || "/dashboard";

    const sessionToken = req.cookies["better-auth.session_token"];

    if (!sessionToken) {
        return res.redirect(`${envVars.FRONTEND_URL}/login?error=oauth_failed`);
    }

    const session = await auth.api.getSession({
        headers: {
            "Cookie": `better-auth.session_token=${sessionToken}`
        }
    })

    if (!session) {
        return res.redirect(`${envVars.FRONTEND_URL}/login?error=no_session_found`);
    }


    if (session && !session.user) {
        return res.redirect(`${envVars.FRONTEND_URL}/login?error=no_user_found`);
    }

    const result = await AuthService.googleLoginSuccess(session);

    const { accessToken, refreshToken } = result;

    tokenUtils.getAccessTokenFromCookie(res, accessToken);
    tokenUtils.getRefreshTokenFromCookie(res, refreshToken);
    // ?redirect=//profile -> /profile
    const isValidRedirectPath = redirectPath.startsWith("/") && !redirectPath.startsWith("//");
    const finalRedirectPath = isValidRedirectPath ? redirectPath : "/dashboard";

    res.redirect(`${envVars.FRONTEND_URL}${finalRedirectPath}`);
})

const handleOAuthError = catchAsync((req: Request, res: Response) => {
    const error = req.query.error as string || "oauth_failed";
    res.redirect(`${envVars.FRONTEND_URL}/login?error=${error}`);
})



export const AuthController = {
    registerStudent,
    loginUser,
    getMe,
    getNewTokens,
    changePassword,
    logoutUser,
    verifyEmail,
    forgetPassword,
    resetPassword,
    googleLogin,
    googleLoginSuccess,
    handleOAuthError,
}