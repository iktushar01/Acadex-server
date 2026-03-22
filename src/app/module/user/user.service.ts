import { Role } from "../../../generated/prisma";
import AppError from "../../errorHelpers/AppError";
import { auth } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { StatusCodes } from "http-status-codes";
import {
    IApproveCRApplicationPayload,
    ICreateAdminPayload,
    ICreateCRApplicationPayload,
} from "./user.interface";

// ─── Shared select shapes ─────────────────────────────────────────────────────

const userPublicSelect = {
    id: true,
    email: true,
    name: true,
    role: true,
    status: true,
    emailVerified: true,
    image: true,
    isDeleted: true,
    createdAt: true,
    updatedAt: true,
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const assertEmailNotTaken = async (email: string) => {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        throw new AppError(
            StatusCodes.CONFLICT,
            "A user with this email already exists",
        );
    }
};

const rollbackAuthUser = async (userId: string) => {
    try {
        await prisma.user.delete({ where: { id: userId } });
    } catch (err) {
        console.error("Rollback failed for auth user:", userId, err);
    }
};

// ─── Admin ────────────────────────────────────────────────────────────────────

/**
 * Creates an ADMIN or SUPER_ADMIN account.
 *
 * The first SUPER_ADMIN is created via the seed script — this endpoint is
 * for subsequent admin/super-admin provisioning by an already-authenticated admin.
 *
 * Role elevation rules:
 *  - SUPER_ADMIN can create ADMIN or SUPER_ADMIN
 *  - ADMIN can only create ADMIN
 */
const createAdmin = async (
    payload: ICreateAdminPayload,
    requestingUserRole: Role,
) => {
    if (
        payload.role === Role.SUPER_ADMIN &&
        requestingUserRole !== Role.SUPER_ADMIN
    ) {
        throw new AppError(
            StatusCodes.FORBIDDEN,
            "Only a Super Admin can create another Super Admin",
        );
    }

    await assertEmailNotTaken(payload.admin.email);

    const { user: authUser } = await auth.api.signUpEmail({
        body: {
            ...payload.admin,
            password: payload.password,
            role: payload.role,
            needPasswordChange: true,
        },
    });

    try {
        return await prisma.$transaction(async (tx) => {
            return tx.admin.create({
                data: {
                    userId: authUser.id,
                    ...payload.admin,
                },
                include: {
                    user: { select: userPublicSelect },
                },
            });
        });
    } catch (error) {
        await rollbackAuthUser(authUser.id);
        throw error;
    }
};

// ─── CR Application ───────────────────────────────────────────────────────────

/**
 * A STUDENT submits an application to become CR.
 * The studentId must be resolved from the authenticated session in the
 * controller — it must never come from the request body.
 */
const applyCRRole = async (payload: ICreateCRApplicationPayload) => {
    const student = await prisma.student.findUnique({
        where: { id: payload.studentId },
        include: { user: { select: { role: true } } },
    });

    if (!student) {
        throw new AppError(StatusCodes.NOT_FOUND, "Student profile not found");
    }

    if (student.user.role === Role.CR) {
        throw new AppError(StatusCodes.CONFLICT, "You are already a CR");
    }

    const pendingApplication = await prisma.cRApplication.findFirst({
        where: { studentId: payload.studentId, status: "PENDING" },
    });

    if (pendingApplication) {
        throw new AppError(
            StatusCodes.CONFLICT,
            "You already have a pending CR application",
        );
    }

    return prisma.cRApplication.create({
        data: {
            studentId: payload.studentId,
            semesterId: payload.semesterId ?? null,
            reason: payload.reason,
            status: "PENDING",
        },
    });
};

/**
 * Admin approves a CR application.
 * Atomically promotes the student's role to CR and creates the CR record.
 */
const approveCRApplication = async (payload: IApproveCRApplicationPayload) => {
    const application = await prisma.cRApplication.findUnique({
        where: { id: payload.applicationId },
        include: { student: { include: { user: true } } },
    });

    if (!application) {
        throw new AppError(StatusCodes.NOT_FOUND, "CR application not found");
    }

    if (application.status !== "PENDING") {
        throw new AppError(
            StatusCodes.BAD_REQUEST,
            `Application is already ${application.status.toLowerCase()}`,
        );
    }

    return prisma.$transaction(async (tx) => {
        await tx.user.update({
            where: { id: application.student.userId },
            data: { role: Role.CR },
        });

        await tx.cRApplication.update({
            where: { id: application.id },
            data: {
                status: "APPROVED",
                adminNote: payload.adminNote ?? null,
                resolvedAt: new Date(),
            },
        });

        return tx.cR.create({
            data: {
                userId: application.student.userId,
                studentId: application.studentId,
                semesterId: application.semesterId ?? undefined,
            },
        });
    });
};

/**
 * Admin rejects a CR application.
 */
const rejectCRApplication = async (
    applicationId: string,
    adminNote?: string,
) => {
    const application = await prisma.cRApplication.findUnique({
        where: { id: applicationId },
    });

    if (!application) {
        throw new AppError(StatusCodes.NOT_FOUND, "CR application not found");
    }

    if (application.status !== "PENDING") {
        throw new AppError(
            StatusCodes.BAD_REQUEST,
            `Application is already ${application.status.toLowerCase()}`,
        );
    }

    return prisma.cRApplication.update({
        where: { id: applicationId },
        data: {
            status: "REJECTED",
            adminNote: adminNote ?? null,
            resolvedAt: new Date(),
        },
    });
};

// ─── Exports ──────────────────────────────────────────────────────────────────

export const UserService = {
    createAdmin,
    applyCRRole,
    approveCRApplication,
    rejectCRApplication,
};