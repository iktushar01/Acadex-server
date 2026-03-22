import { StatusCodes } from "http-status-codes";
import { Role } from "../../../generated/prisma";
import AppError from "../../errorHelpers/AppError";
import { auth } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import {
    IApproveCRApplicationPayload,
    ICreateAdminPayload,
    ICreateCRApplicationPayload,
    ICreateStudentPayload,
} from "./user.interface";

// ─── Shared select shapes ────────────────────────────────────────────────────

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

const studentPublicSelect = {
    id: true,
    userId: true,
    name: true,
    email: true,
    profilePhoto: true,
    contactNumber: true,
    address: true,
    gender: true,
    createdAt: true,
    updatedAt: true,
    user: { select: userPublicSelect },
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Throws CONFLICT if the email is already registered. */
const assertEmailNotTaken = async (email: string) => {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        throw new AppError(StatusCodes.CONFLICT, "A user with this email already exists");
    }
};

/**
 * Rolls back an auth user that was already created when the subsequent
 * DB transaction fails.  Swallows its own errors so the original error
 * is always re-thrown to the caller.
 */
const rollbackAuthUser = async (userId: string) => {
    try {
        await prisma.user.delete({ where: { id: userId } });
    } catch (rollbackErr) {
        console.error("Rollback failed for user:", userId, rollbackErr);
    }
};

// ─── Student ─────────────────────────────────────────────────────────────────

const createStudent = async (payload: ICreateStudentPayload) => {
    await assertEmailNotTaken(payload.student.email);

    const { user: authUser } = await auth.api.signUpEmail({
        body: {
            email: payload.student.email,
            password: payload.password,
            name: payload.student.name,
            role: Role.STUDENT,
            needPasswordChange: true,
        },
    });

    try {
        return await prisma.$transaction(async (tx) => {
            await tx.student.create({
                data: {
                    userId: authUser.id,
                    ...payload.student,
                },
            });

            return tx.student.findUniqueOrThrow({
                where: { userId: authUser.id },
                select: studentPublicSelect,
            });
        });
    } catch (error) {
        await rollbackAuthUser(authUser.id);
        throw error;
    }
};

// ─── CR Application ──────────────────────────────────────────────────────────

/**
 * A regular STUDENT submits an application to become CR.
 * The studentId is taken from the authenticated session — callers
 * should pass `req.user.studentId` (resolved via the student record).
 */
const applyCRRole = async (payload: ICreateCRApplicationPayload) => {
    const student = await prisma.student.findUnique({
        where: { id: payload.studentId },
        include: { user: { select: { role: true } } },
    });

    if (!student) {
        throw new AppError(StatusCodes.NOT_FOUND, "Student not found");
    }

    if (student.user.role === Role.CR) {
        throw new AppError(StatusCodes.CONFLICT, "Student is already a CR");
    }

    // Prevent duplicate pending applications
    const existingApplication = await prisma.cRApplication.findFirst({
        where: { studentId: payload.studentId, status: "PENDING" },
    });

    if (existingApplication) {
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
 * Admin approves a CR application: promotes the student's role to CR
 * and creates the CR record inside a transaction.
 */
const approveCRApplication = async (
    payload: IApproveCRApplicationPayload,
) => {
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
        // Promote the user role to CR
        await tx.user.update({
            where: { id: application.student.userId },
            data: { role: Role.CR },
        });

        // Mark the application approved
        await tx.cRApplication.update({
            where: { id: application.id },
            data: {
                status: "APPROVED",
                adminNote: payload.adminNote ?? null,
                resolvedAt: new Date(),
            },
        });

        // Create the CR record (maps to your CR model)
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

// ─── Admin ───────────────────────────────────────────────────────────────────

/**
 * Creates an ADMIN or SUPER_ADMIN user.
 *
 * Role-elevation rules (enforced here, not only in middleware):
 *  - SUPER_ADMIN  → may create ADMIN or SUPER_ADMIN
 *  - ADMIN        → may only create ADMIN
 */
const createAdmin = async (
    payload: ICreateAdminPayload,
    requestingUserRole: Role,
) => {
    // Guard: only SUPER_ADMIN may promote to SUPER_ADMIN
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

// ─── Exports ─────────────────────────────────────────────────────────────────

export const UserService = {
    createStudent,
    createAdmin,
    applyCRRole,
    approveCRApplication,
    rejectCRApplication,
};