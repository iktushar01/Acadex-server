import { Role, User, UserStatus } from "../../../generated/prisma";
import AppError from "../../errorHelpers/AppError";
import { auth } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { StatusCodes } from "http-status-codes";
import { tokenUtils } from "../../utils/token";
import { jwtUtils } from "../../utils/jwt";
import { envVars } from "../../../config/env";
import { IChangePassWordPayload, ILoginUser, IRegisterStudent, IRequestUser } from "./auth.interface";




const registerStudent = async (payload: IRegisterStudent) => {
    const { name, email, password } = payload;

    const data = await auth.api.signUpEmail({
        body: {
            name,
            email,
            password,
        }
    })

    if (!data.user) {
        throw new AppError(StatusCodes.BAD_REQUEST, "User registration failed");
    }

    //:TODO: create Student profile 
    const Student = await prisma.$transaction(async (tx) => {
        try {
            const StudentTx = await tx.student.create({
                data: {
                    userId: data.user.id,
                    name: payload.name,
                    email: payload.email,
                },
            });

            const accessToken = tokenUtils.getAccessToken({
                userId: data.user.id,
                role: data.user.role as Role,
                name: data.user.name,
                email: data.user.email,
                status: data.user.status as UserStatus,
                isDeleted: !!data.user.isDeleted,
                emailVerified: data.user.emailVerified,
            });

            const refreshToken = tokenUtils.getRefreshToken({
                userId: data.user.id,
                role: data.user.role as Role,
                name: data.user.name,
                email: data.user.email,
                status: data.user.status as UserStatus,
                isDeleted: !!data.user.isDeleted,
                emailVerified: data.user.emailVerified,
            });

            return {
                ...data,
                Student: StudentTx,
                accessToken,
                refreshToken,
                token: data.token,
            };
        } catch (error) {
            await tx.Student.delete({
                where: {
                    userId: data.user.id,
                },
            });
            throw error;
        }
    })

    return Student;
}

const loginUser = async (payload: ILoginUser) => {
    const { email, password } = payload;
    const data = await auth.api.signInEmail({
        body: {
            email,
            password,
        }
    })

    if (data.user.status === UserStatus.SUSPENDED) {
        throw new AppError(StatusCodes.BAD_REQUEST, "User is suspended");
    }

    if (data.user.isDeleted || data.user.status === UserStatus.DELETED) {
        throw new AppError(StatusCodes.BAD_REQUEST, "User is deleted");
    }

    if (!data.user) {
        throw new AppError(StatusCodes.UNAUTHORIZED, "User login failed");
    }

    const { user } = data;
    const accessToken = tokenUtils.getAccessToken({
        userId: user.id,
        role: user.role,
        name: user.name,
        email: user.email,
        status: user.status,
        isDeleted: user.isDeleted,
        emailVerified: user.emailVerified,
    })
    const refreshToken = tokenUtils.getRefreshToken({
        userId: user.id,
        role: user.role,
        name: user.name,
        email: user.email,
        status: user.status,
        isDeleted: user.isDeleted,
        emailVerified: user.emailVerified,
    })
    return {
        ...data,
        accessToken,
        refreshToken,
        token: data.token,
    }
}

const getMe = async (user: IRequestUser) => {
    const isUserExist = await prisma.user.findUnique({
        where: {
            id: user.userId,
        },
        include: {
            Student: {
                include: {
                    appointments: true,
                    reviews: true,
                    prescriptions: true,
                    medicalReports: true,
                    StudentHealthData: true,
                }
            },
            doctor: {
                include: {
                    specialties: true,
                    appointments: true,
                    reviews: true,
                    prescriptions: true,
                }
            },
            admin: true,
        }
    })
    if (!isUserExist) {
        throw new AppError(StatusCodes.NOT_FOUND, "User not found");
    }
    return isUserExist;
}

const getNewTokens = async (refreshToken: string, sessionToken: string) => {
    if (!refreshToken || !sessionToken) {
        throw new AppError(StatusCodes.UNAUTHORIZED, "Invalid request. Tokens are missing.");
    }

    const isSessionTokenExist = await prisma.session.findUnique({
        where: {
            token: sessionToken
        },
        include: {
            user: true,
        }
    })
    if (!isSessionTokenExist) {
        throw new AppError(StatusCodes.UNAUTHORIZED, "Invalid session token");
    }

    const varifiedRefreshToken = jwtUtils.verifyToken(refreshToken, envVars.REFRESH_TOKEN_SECRET);

    if (!varifiedRefreshToken.success || !varifiedRefreshToken.decoded) {
        throw new AppError(StatusCodes.UNAUTHORIZED, "Invalid refresh token");
    }

    const { decoded } = varifiedRefreshToken;

    const newAccessToken = tokenUtils.getAccessToken({
        userId: decoded.userId,
        role: decoded.role,
        name: decoded.name,
        email: decoded.email,
        status: decoded.status,
        isDeleted: decoded.isDeleted,
        emailVerified: decoded.emailVerified,
    })
    const newRefreshToken = tokenUtils.getRefreshToken({
        userId: decoded.userId,
        role: decoded.role,
        name: decoded.name,
        email: decoded.email,
        status: decoded.status,
        isDeleted: decoded.isDeleted,
        emailVerified: decoded.emailVerified,
    })


    const { token } = await prisma.session.update({
        where: {
            token: sessionToken
        },
        data: {
            token: newRefreshToken,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            updatedAt: new Date(),
        }
    })
    return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        updatedToken: token,
    }

}

const changePassword = async (payload: IChangePassWordPayload, sessionToken: string) => {
    const session = await auth.api.getSession({
        headers: new Headers({
            Authorization: `Bearer ${sessionToken}`
        })
    })

    if (!session) {
        throw new AppError(StatusCodes.UNAUTHORIZED, "Invalid session token");
    }

    const { currentPassword, newPassword } = payload;

    const result = await auth.api.changePassword({
        body: {
            currentPassword,
            newPassword,
            revokeOtherSessions: true,
        },
        headers: new Headers({
            Authorization: `Bearer ${sessionToken}`
        })
    })

    if (session.user.needPasswordChange) {
        await prisma.user.update({
            where: {
                id: session.user.id,
            },
            data: {
                needPasswordChange: false,
            }
        })
    }

    const accessToken = tokenUtils.getAccessToken({
        userId: session.user.id,
        role: session.user.role,
        name: session.user.name,
        email: session.user.email,
        status: session.user.status,
        isDeleted: session.user.isDeleted,
        emailVerified: session.user.emailVerified,
    });

    const refreshToken = tokenUtils.getRefreshToken({
        userId: session.user.id,
        role: session.user.role,
        name: session.user.name,
        email: session.user.email,
        status: session.user.status,
        isDeleted: session.user.isDeleted,
        emailVerified: session.user.emailVerified,
    });


    return {
        ...result,
        accessToken,
        refreshToken,
    }
}

const logoutUser = async (sessionToken: string) => {
    const result = await auth.api.signOut({
        headers: new Headers({
            Authorization: `Bearer ${sessionToken}`
        })
    })

    return result;
}


const verifyEmail = async (email: string, otp: string) => {

    const result = await auth.api.verifyEmailOTP({
        body: {
            email,
            otp,
        }
    })

    if (result.status && !result.user.emailVerified) {
        await prisma.user.update({
            where: {
                email,
            },
            data: {
                emailVerified: true,
            }
        })
    }
}

const forgetPassword = async (email: string) => {
    const isUserExist = await prisma.user.findUnique({
        where: {
            email,
        }
    })

    if (!isUserExist) {
        throw new AppError(StatusCodes.NOT_FOUND, "User not found");
    }

    if (!isUserExist.emailVerified) {
        throw new AppError(StatusCodes.BAD_REQUEST, "Email not verified");
    }

    if (isUserExist.isDeleted || isUserExist.status === UserStatus.DELETED) {
        throw new AppError(StatusCodes.NOT_FOUND, "User not found");
    }

    await auth.api.requestPasswordResetEmailOTP({
        body: {
            email,
        }
    })
}

const resetPassword = async (email: string, otp: string, newPassword: string) => {
    const isUserExist = await prisma.user.findUnique({
        where: {
            email,
        }
    })

    if (!isUserExist) {
        throw new AppError(StatusCodes.NOT_FOUND, "User not found");
    }

    if (!isUserExist.emailVerified) {
        throw new AppError(StatusCodes.BAD_REQUEST, "Email not verified");
    }

    if (isUserExist.isDeleted || isUserExist.status === UserStatus.DELETED) {
        throw new AppError(StatusCodes.NOT_FOUND, "User not found");
    }

    await auth.api.resetPasswordEmailOTP({
        body: {
            email,
            otp,
            password: newPassword,
        }
    })

    if (isUserExist.needPasswordChange) {
        await prisma.user.update({
            where: {
                id: isUserExist.id,
            },
            data: {
                needPasswordChange: false,
            }
        })
    }

    await prisma.session.deleteMany({
        where: {
            userId: isUserExist.id,
        }
    })
}

const googleLoginSuccess = async (session: Record<string, any>) => {
    const isStudentExists = await prisma.Student.findUnique({
        where: {
            userId: session.user.id,
        }
    })

    if (!isStudentExists) {
        await prisma.Student.create({
            data: {
                userId: session.user.id,
                name: session.user.name,
                email: session.user.email,
            }

        })
    }

    const accessToken = tokenUtils.getAccessToken({
        userId: session.user.id,
        role: session.user.role,
        name: session.user.name,
    });

    const refreshToken = tokenUtils.getRefreshToken({
        userId: session.user.id,
        role: session.user.role,
        name: session.user.name,
    });

    return {
        accessToken,
        refreshToken,
    }
}


export const AuthService = {
    registerStudent,
    loginUser,
    getMe,
    getNewTokens,
    changePassword,
    logoutUser,
    verifyEmail,
    forgetPassword,
    resetPassword,
    googleLoginSuccess,
}