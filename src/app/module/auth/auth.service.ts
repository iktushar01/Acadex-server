import type { Prisma } from "../../../generated/prisma/index";
import { Prisma as PrismaValue, Role, UserStatus } from "../../lib/prisma-exports";
import AppError from "../../errorHelpers/AppError";
import { auth } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { StatusCodes } from "http-status-codes";
import { tokenUtils } from "../../utils/token";
import { jwtUtils } from "../../utils/jwt";
import { envVars } from "../../../config/env";
import { uploadFileToCloudinary, deleteFileFromCloudinary } from "../../../config/cloudinary.config";
import {
    IChangePassWordPayload,
    ILoginUser,
    IRegisterStudent,
    IRequestUser,
    IUpdateProfilePayload,
} from "./auth.interface";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Builds both JWT tokens from a consistent user-shaped object.
 * Centralised so every code path produces identical token payloads.
 */
const buildTokenPair = (user: {
    id: string;
    role: Role;
    name: string;
    email: string;
    status: UserStatus;
    isDeleted: boolean;
    emailVerified: boolean;
}) => {
    const payload = {
        userId: user.id,
        role: user.role,
        name: user.name,
        email: user.email,
        status: user.status,
        isDeleted: user.isDeleted,
        emailVerified: user.emailVerified,
    };
    return {
        accessToken: tokenUtils.getAccessToken(payload),
        refreshToken: tokenUtils.getRefreshToken(payload),
    };
};

// ─── Register ─────────────────────────────────────────────────────────────────

const registerStudent = async (payload: IRegisterStudent, fileBuffer?: Buffer, fileName?: string) => {
    const { name, email, password } = payload;

    // 1. Prepare upload promise
    const uploadPromise = fileBuffer && fileName
        ? uploadFileToCloudinary(fileBuffer, fileName)
            .then(res => res.secure_url)
            .catch(() => {
                throw new AppError(StatusCodes.BAD_REQUEST, "Failed to upload image. Please try again.");
            })
        : Promise.resolve(undefined);

    // 2. Prepare auth user promise (without image initially to run them in parallel)
    const signUpPromise = auth.api.signUpEmail({
        body: { name, email, password },
    });

    // Run Cloudinary Upload (I/O bound) and Bcrypt Hashing (CPU bound) concurrently to save 1-2 seconds
    let imageUrl: string | undefined;
    let authData;
    
    try {
        [imageUrl, authData] = await Promise.all([uploadPromise, signUpPromise]);
    } catch (error: any) {
        // Map better-auth duplicate user error to a standard AppError
        if (error?.message?.toLowerCase().includes("exist") || error?.status === 409) {
            throw new AppError(StatusCodes.CONFLICT, "A user with this email already exists");
        }
        throw error;
    }

    if (!authData?.user) {
        if (imageUrl) {
            await deleteFileFromCloudinary(imageUrl, "image").catch(() => {});
        }
        throw new AppError(StatusCodes.BAD_REQUEST, "User registration failed");
    }

    try {
        // Create the student profile and update the user's image URL in a single transaction
        const [student] = await prisma.$transaction(async (tx) => {
            const createdStudent = await tx.student.create({
                data: {
                    userId: authData.user.id,
                    name,
                    email,
                    ...(imageUrl !== undefined ? { profilePhoto: imageUrl } : {}),
                },
            });

            // Update user image if there was an upload
            if (imageUrl) {
                await tx.user.update({
                    where: { id: authData.user.id },
                    data: { image: imageUrl },
                });
                
                // Also update the session user context object so we can use it properly below
                authData.user.image = imageUrl;
            }

            return [createdStudent];
        });

        const { accessToken, refreshToken } = buildTokenPair({
            id: authData.user.id,
            role: authData.user.role as Role,
            name: authData.user.name,
            email: authData.user.email,
            status: authData.user.status as UserStatus,
            isDeleted: !!authData.user.isDeleted,
            emailVerified: authData.user.emailVerified,
        });

        return {
            user: authData.user,
            student,
            token: authData.token,
            accessToken,
            refreshToken,
        };
    } catch (error) {
        // Rollback the auth user and delete the uploaded image if needed
        try {
            if (imageUrl) {
                await deleteFileFromCloudinary(imageUrl, "image");
            }
            await prisma.user.delete({ where: { id: authData.user.id } });
        } catch (rollbackErr) {
            console.error("Rollback failed for user:", authData.user.id, rollbackErr);
        }

        if (
            error instanceof PrismaValue.PrismaClientKnownRequestError &&
            error.code === "P2002"
        ) {
            throw new AppError(
                StatusCodes.CONFLICT,
                "This email is already registered. Please log in or use a different email."
            );
        }

        throw error;
    }
};

// ─── Login ────────────────────────────────────────────────────────────────────

const loginUser = async (payload: ILoginUser) => {
    const { email, password } = payload;

    // Guard checks before attempting sign-in (avoids leaking auth errors)
    const dbUser = await prisma.user.findUnique({ where: { email } });

    if (!dbUser) {
        // Use UNAUTHORIZED — do not confirm whether the email exists
        throw new AppError(StatusCodes.UNAUTHORIZED, "Invalid email or password");
    }

    if (dbUser.isDeleted || dbUser.status === UserStatus.DELETED) {
        throw new AppError(StatusCodes.FORBIDDEN, "This account has been deleted");
    }

    if (dbUser.status === UserStatus.SUSPENDED) {
        throw new AppError(StatusCodes.FORBIDDEN, "This account has been suspended");
    }

    // Credentials are validated by better-auth
    const authData = await auth.api.signInEmail({ body: { email, password } });

    const { accessToken, refreshToken } = buildTokenPair({
        id: authData.user.id,
        role: authData.user.role as Role,
        name: authData.user.name,
        email: authData.user.email,
        status: authData.user.status as UserStatus,
        isDeleted: !!authData.user.isDeleted,
        emailVerified: authData.user.emailVerified,
    });

    return {
        user: authData.user,
        token: authData.token,
        accessToken,
        refreshToken,
    };
};

// ─── Get Me ───────────────────────────────────────────────────────────────────

const fetchCurrentUserById = async (userId: string) => {
    const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            student: true,
            admin: true,
        },
    });

    if (!dbUser) {
        throw new AppError(StatusCodes.NOT_FOUND, "User not found");
    }

    return dbUser;
};

const getMe = async (user: IRequestUser) => {
    return fetchCurrentUserById(user.userId);
};

const updateProfile = async (payload: IUpdateProfilePayload) => {
    const {
        userId,
        role,
        name,
        profilePhoto,
        fileBuffer,
        fileName,
        contactNumber,
        address,
        gender,
    } = payload;

    const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            role: true,
            student: { select: { id: true } },
            admin: { select: { id: true } },
        },
    });

    if (!dbUser) {
        throw new AppError(StatusCodes.NOT_FOUND, "User not found");
    }

    const uploadedProfilePhoto =
        fileBuffer && fileName
            ? await uploadFileToCloudinary(fileBuffer, fileName).then((result) => result.secure_url)
            : undefined;

    const finalProfilePhoto =
        uploadedProfilePhoto !== undefined ? uploadedProfilePhoto : profilePhoto;

    await prisma.$transaction(async (tx) => {
        const userUpdateData: Prisma.UserUpdateInput = {};

        if (name !== undefined) {
            userUpdateData.name = name;
        }

        if (finalProfilePhoto !== undefined) {
            userUpdateData.image = finalProfilePhoto;
        }

        if (Object.keys(userUpdateData).length > 0) {
            await tx.user.update({
                where: { id: userId },
                data: userUpdateData,
            });
        }

        if (role === Role.STUDENT && dbUser.student) {
            const studentUpdateData: Prisma.StudentUpdateInput = {};

            if (name !== undefined) {
                studentUpdateData.name = name;
            }
            if (finalProfilePhoto !== undefined) {
                studentUpdateData.profilePhoto = finalProfilePhoto;
            }
            if (contactNumber !== undefined) {
                studentUpdateData.contactNumber = contactNumber;
            }
            if (address !== undefined) {
                studentUpdateData.address = address;
            }
            if (gender !== undefined) {
                studentUpdateData.gender = gender;
            }

            if (Object.keys(studentUpdateData).length > 0) {
                await tx.student.update({
                    where: { userId },
                    data: studentUpdateData,
                });
            }
        }

        if ((role === Role.ADMIN || role === Role.SUPER_ADMIN) && dbUser.admin) {
            const adminUpdateData: Prisma.AdminUpdateInput = {};

            if (name !== undefined) {
                adminUpdateData.name = name;
            }
            if (finalProfilePhoto !== undefined) {
                adminUpdateData.profilePhoto = finalProfilePhoto;
            }
            if (contactNumber !== undefined) {
                adminUpdateData.contactNumber = contactNumber;
            }

            if (Object.keys(adminUpdateData).length > 0) {
                await tx.admin.update({
                    where: { userId },
                    data: adminUpdateData,
                });
            }
        }
    });

    return fetchCurrentUserById(userId);
};

// ─── Refresh tokens ───────────────────────────────────────────────────────────

const getNewTokens = async (oldRefreshToken: string, sessionToken?: string) => {
    // Verify the refresh JWT is valid and not tampered with
    const verified = jwtUtils.verifyToken(oldRefreshToken, envVars.REFRESH_TOKEN_SECRET);

    if (!verified.success || !verified.decoded) {
        throw new AppError(StatusCodes.UNAUTHORIZED, "Invalid refresh token");
    }

    const { decoded } = verified;

    const { accessToken, refreshToken: newRefreshToken } = buildTokenPair({
        id: decoded.userId,
        role: decoded.role,
        name: decoded.name,
        email: decoded.email,
        status: decoded.status,
        isDeleted: decoded.isDeleted,
        emailVerified: decoded.emailVerified,
    });

    // The DB session token is better-auth's own token — we intentionally do NOT
    // overwrite it with our JWT refresh token. We just touch the expiry so the
    // session stays alive while the user is active.
    if (sessionToken) {
        const session = await prisma.session.findUnique({
            where: { token: sessionToken },
            include: { user: true },
        });

        if (session) {
            await prisma.session.update({
                where: { token: sessionToken },
                data: {
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    updatedAt: new Date(),
                },
            });
        }
    }

    return {
        accessToken,
        refreshToken: newRefreshToken,
    };
};

// ─── Change Password ──────────────────────────────────────────────────────────

const changePassword = async (
    payload: IChangePassWordPayload,
    sessionToken: string,
) => {
    const session = await auth.api.getSession({
        headers: new Headers({ Authorization: `Bearer ${sessionToken}` }),
    });

    if (!session?.user) {
        throw new AppError(StatusCodes.UNAUTHORIZED, "Invalid or expired session");
    }

    const { currentPassword, newPassword } = payload;

    await auth.api.changePassword({
        body: { currentPassword, newPassword, revokeOtherSessions: true },
        headers: new Headers({ Authorization: `Bearer ${sessionToken}` }),
    });

    // Clear the forced-password-change flag if it was set
    if (session.user.needPasswordChange) {
        await prisma.user.update({
            where: { id: session.user.id },
            data: { needPasswordChange: false },
        });
    }

    const { accessToken, refreshToken } = buildTokenPair({
        id: session.user.id,
        role: session.user.role as Role,
        name: session.user.name,
        email: session.user.email,
        status: session.user.status as UserStatus,
        isDeleted: !!session.user.isDeleted,
        emailVerified: session.user.emailVerified,
    });

    return { accessToken, refreshToken };
};

// ─── Logout ───────────────────────────────────────────────────────────────────

const logoutUser = async (sessionToken: string) => {
    if (!sessionToken) {
        throw new AppError(StatusCodes.UNAUTHORIZED, "No active session");
    }

    return auth.api.signOut({
        headers: new Headers({ Authorization: `Bearer ${sessionToken}` }),
    });
};

// ─── Email verification ───────────────────────────────────────────────────────

const verifyEmail = async (email: string, otp: string) => {
    const result = await auth.api.verifyEmailOTP({ body: { email, otp } });

    // better-auth may not always flush the DB field — ensure it is set
    if (result?.status && !result.user?.emailVerified) {
        await prisma.user.update({
            where: { email },
            data: { emailVerified: true },
        });
    }
};

// ─── Forget / Reset password ──────────────────────────────────────────────────

const forgetPassword = async (email: string) => {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.isDeleted || user.status === UserStatus.DELETED) {
        // Return generic success to avoid email enumeration
        return;
    }

    if (!user.emailVerified) {
        throw new AppError(StatusCodes.BAD_REQUEST, "Please verify your email first");
    }

    await auth.api.requestPasswordResetEmailOTP({ body: { email } });
};

const resetPassword = async (
    email: string,
    otp: string,
    newPassword: string,
) => {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.isDeleted || user.status === UserStatus.DELETED) {
        throw new AppError(StatusCodes.NOT_FOUND, "User not found");
    }

    if (!user.emailVerified) {
        throw new AppError(StatusCodes.BAD_REQUEST, "Please verify your email first");
    }

    await auth.api.resetPasswordEmailOTP({
        body: { email, otp, password: newPassword },
    });

    // Invalidate all sessions after a password reset for security
    await prisma.$transaction([
        prisma.session.deleteMany({ where: { userId: user.id } }),
        ...(user.needPasswordChange
            ? [
                  prisma.user.update({
                      where: { id: user.id },
                      data: { needPasswordChange: false },
                  }),
              ]
            : []),
    ]);
};

// ─── Google OAuth ─────────────────────────────────────────────────────────────

const googleLoginSuccess = async (session: {
    user: {
        id: string;
        name: string;
        email: string;
        role: string;
        status: string;
        isDeleted?: boolean | null;
        emailVerified: boolean;
        image?: string | null | undefined;
    };
}) => {
    const { user } = session;

    // Lazily create the student profile if this is the first Google sign-in
    const studentExists = await prisma.student.findUnique({
        where: { userId: user.id },
    });

    if (!studentExists) {
        await prisma.student.create({
            data: {
                userId: user.id,
                name: user.name,
                email: user.email,
                ...(user.image !== undefined ? { profilePhoto: user.image } : {}),
            },
        });
    }

    const { accessToken, refreshToken } = buildTokenPair({
        id: user.id,
        role: user.role as Role,
        name: user.name,
        email: user.email,
        status: user.status as UserStatus,
        isDeleted: !!user.isDeleted,
        emailVerified: user.emailVerified,
    });

    return { accessToken, refreshToken, user };
};

const issueTokensFromOAuthCode = async (user: {
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    isDeleted?: boolean | null;
    emailVerified: boolean;
    image?: string | null | undefined;
}) => {
    const { accessToken, refreshToken } = buildTokenPair({
        id: user.id,
        role: user.role as Role,
        name: user.name,
        email: user.email,
        status: user.status as UserStatus,
        isDeleted: !!user.isDeleted,
        emailVerified: user.emailVerified,
    });

    return { accessToken, refreshToken, user };
};

// ─── Exports ──────────────────────────────────────────────────────────────────

export const AuthService = {
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
    googleLoginSuccess,
    issueTokensFromOAuthCode,
};
