import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { envVars } from "../../../config/env";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { cookieUtils } from "../../utils/cookies";
import { tokenUtils } from "../../utils/token";
import { auth } from "../../lib/auth";
import AppError from "../../errorHelpers/AppError";
import { IRequestUser } from "./auth.interface";
import { AuthService } from "./auth.service";
import ms, { StringValue } from "ms";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Writes all three auth cookies in one call. */
const setAuthCookies = (
    res: Response,
    tokens: { accessToken: string; refreshToken: string; sessionToken?: string } ,
) => {
    tokenUtils.getAccessTokenFromCookie(res, tokens.accessToken);
    tokenUtils.getRefreshTokenFromCookie(res, tokens.refreshToken);
    if (tokens.sessionToken) {
        tokenUtils.getBetterAuthAccessToken(res, tokens.sessionToken);
        res.cookie("better-auth.session_token", tokens.sessionToken, {
            httpOnly: true,
            secure: envVars.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: ms(envVars.BETTER_AUTH_SESSION_TOKEN_EXPIRES_IN as StringValue),
        });
    }
};

const clearAuthCookies = (res: Response) => {
    const opts = { httpOnly: true, secure: true, sameSite: "none" as const };
    cookieUtils.clearCookie(res, "accessToken", opts);
    cookieUtils.clearCookie(res, "refreshToken", opts);
    cookieUtils.clearCookie(res, "better-auth.session_token", opts);
};

// ─── Register ─────────────────────────────────────────────────────────────────

const registerStudent = catchAsync(async (req: Request, res: Response) => {
    const fileBuffer = (req as any).file?.buffer;
    const fileName = (req as any).file?.originalname;
    const result = await AuthService.registerStudent(req.body, fileBuffer, fileName);

    setAuthCookies(res, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        ...(result.token ? { sessionToken: result.token } : {}),
    });

    sendResponse(res, {
        statusCode: StatusCodes.CREATED,
        success: true,
        message: "Student registered successfully",
        data: {
            user: result.user,
            student: result.student,
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            token: result.token,
        },
    });
});

// ─── Login ────────────────────────────────────────────────────────────────────

const loginUser = catchAsync(async (req: Request, res: Response) => {
    const result = await AuthService.loginUser(req.body);

    setAuthCookies(res, {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        ...(result.token ? { sessionToken: result.token } : {}),
    });

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Logged in successfully",
        data: { 
            user: result.user, 
            accessToken: result.accessToken, 
            refreshToken: result.refreshToken, 
            token: result.token 
        },
    });
});

// ─── Get Me ───────────────────────────────────────────────────────────────────

const getMe = catchAsync(async (req: Request, res: Response) => {
    const result = await AuthService.getMe(req.user as IRequestUser);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "User fetched successfully",
        data: result,
    });
});

const updateProfile = catchAsync(async (req: Request, res: Response) => {
    const user = req.user as IRequestUser;
    const fileBuffer = (req as any).file?.buffer;
    const fileName = (req as any).file?.originalname;

    const result = await AuthService.updateProfile({
        userId: user.userId,
        role: user.role,
        name: req.body.name,
        profilePhoto: req.body.profilePhoto,
        fileBuffer,
        fileName,
        contactNumber: req.body.contactNumber,
        address: req.body.address,
        gender: req.body.gender,
    });

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Profile updated successfully",
        data: result,
    });
});

// ─── Refresh Tokens ───────────────────────────────────────────────────────────

const getNewTokens = catchAsync(async (req: Request, res: Response) => {
    const oldRefreshToken = req.cookies.refreshToken;
    const sessionToken = req.cookies["better-auth.session_token"];

    if (!oldRefreshToken || !sessionToken) {
        throw new AppError(
            StatusCodes.UNAUTHORIZED,
            "Refresh token or session token not found",
        );
    }

    const result = await AuthService.getNewTokens(oldRefreshToken, sessionToken);

    tokenUtils.getAccessTokenFromCookie(res, result.accessToken);
    tokenUtils.getRefreshTokenFromCookie(res, result.refreshToken);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Tokens refreshed successfully",
        data: {
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
        },
    });
});

// ─── Change Password ──────────────────────────────────────────────────────────

const changePassword = catchAsync(async (req: Request, res: Response) => {
    const sessionToken = req.cookies["better-auth.session_token"];
    const result = await AuthService.changePassword(req.body, sessionToken);

    tokenUtils.getAccessTokenFromCookie(res, result.accessToken);
    tokenUtils.getRefreshTokenFromCookie(res, result.refreshToken);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Password changed successfully",
        data: null,
    });
});

// ─── Logout ───────────────────────────────────────────────────────────────────

const logoutUser = catchAsync(async (req: Request, res: Response) => {
    const sessionToken = req.cookies["better-auth.session_token"];
    await AuthService.logoutUser(sessionToken);

    clearAuthCookies(res);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Logged out successfully",
        data: null,
    });
});

// ─── Email Verification ───────────────────────────────────────────────────────

const verifyEmail = catchAsync(async (req: Request, res: Response) => {
    const { email, otp } = req.body;
    await AuthService.verifyEmail(email, otp);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Email verified successfully",
        data: null,
    });
});

// ─── Forget / Reset Password ──────────────────────────────────────────────────

const forgetPassword = catchAsync(async (req: Request, res: Response) => {
    await AuthService.forgetPassword(req.body.email);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        // Generic message — do not confirm whether the email is registered
        message: "If that email is registered you will receive a reset OTP shortly",
        data: null,
    });
});

const resetPassword = catchAsync(async (req: Request, res: Response) => {
    const { email, otp, newPassword } = req.body;
    await AuthService.resetPassword(email, otp, newPassword);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Password reset successfully. Please log in again.",
        data: null,
    });
});

// ─── Google OAuth ─────────────────────────────────────────────────────────────

const googleLogin = catchAsync((req: Request, res: Response) => {
    const redirectPath = (req.query.redirect as string) || "/dashboard";
    const encodedRedirectPath = encodeURIComponent(redirectPath);
    const callbackURL = `${envVars.BETTER_AUTH_URL}/api/v1/auth/google/success?redirect=${encodedRedirectPath}`;

    res.render("googleRedirect", {
        callbackURL,
        betterAuthUrl: envVars.BETTER_AUTH_URL,
    });
});

const googleLoginSuccess = catchAsync(async (req: Request, res: Response) => {
    const redirectPath = (req.query.redirect as string) || "/dashboard";
    const sessionToken = req.cookies["better-auth.session_token"];

    if (!sessionToken) {
        return res.redirect(`${envVars.FRONTEND_URL}/login?error=oauth_failed`);
    }

    const session = await auth.api.getSession({
        headers: { Cookie: `better-auth.session_token=${sessionToken}` },
    });

    if (!session?.user) {
        return res.redirect(`${envVars.FRONTEND_URL}/login?error=no_session_found`);
    }

    const result = await AuthService.googleLoginSuccess(session);

    tokenUtils.getAccessTokenFromCookie(res, result.accessToken);
    tokenUtils.getRefreshTokenFromCookie(res, result.refreshToken);

    // Validate redirect path — must start with "/" but not "//" (open redirect guard)
    const safeRedirect =
        redirectPath.startsWith("/") && !redirectPath.startsWith("//")
            ? redirectPath
            : "/dashboard";

    res.redirect(`${envVars.FRONTEND_URL}${safeRedirect}`);
});

const handleOAuthError = catchAsync((req: Request, res: Response) => {
    const error = (req.query.error as string) || "oauth_failed";
    res.redirect(`${envVars.FRONTEND_URL}/login?error=${error}`);
});

// ─── Exports ──────────────────────────────────────────────────────────────────

export const AuthController = {
    registerStudent,
    loginUser,
    getMe,
    updateProfile,
    getNewTokens,
    changePassword,
    logoutUser,
    verifyEmail,
    forgetPassword,
    resetPassword,
    googleLogin,
    googleLoginSuccess,
    handleOAuthError,
};
