import { Role, UserStatus } from "../../../generated/prisma";

export interface IRegisterStudent {
    name: string;
    email: string;
    password: string;
    image?: string;
}

export interface ILoginUser {
    email: string;
    password: string;
}

/**
 * Shape of the decoded JWT payload attached to req.user by checkAuth middleware.
 * All fields must be present — token generation always includes them.
 */
export interface IRequestUser {
    userId: string;
    role: Role;
    name: string;
    email: string;
    status: UserStatus;
    isDeleted: boolean;
    emailVerified: boolean;
    iat: number;
    exp: number;
}

export interface IChangePassWordPayload {
    currentPassword: string;
    newPassword: string;
}