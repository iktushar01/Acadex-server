import { Gender, Role } from "../../../generated/prisma";

// ─── Student ────────────────────────────────────────────────────────────────

export interface IStudentCore {
    name: string;
    email: string;
    profilePhoto?: string;
    contactNumber?: string;
    address?: string;
    gender: Gender;
}

export interface ICreateStudentPayload {
    password: string;
    student: IStudentCore;
}

// ─── CR (Class Representative) ──────────────────────────────────────────────

/**
 * CR application submitted by a student via form/email.
 * Admin reviews and approves/rejects. On approval, student's role is
 * promoted to CR and a CR record is created.
 */
export interface ICreateCRApplicationPayload {
    studentId: string;       // The student applying for CR
    semesterId?: string;     // Which semester/class they want to represent
    reason: string;          // Why they want to be CR
}

export interface IApproveCRApplicationPayload {
    applicationId: string;
    adminNote?: string;
}

// ─── Admin / Super Admin ─────────────────────────────────────────────────────

export interface IAdminCore {
    name: string;
    email: string;
    profilePhoto?: string;
    contactNumber?: string;
}

/**
 * Only SUPER_ADMIN can create another SUPER_ADMIN.
 * ADMIN can only create ADMIN — enforced at service layer.
 */
export interface ICreateAdminPayload {
    password: string;
    admin: IAdminCore;
    role: Extract<Role, "ADMIN" | "SUPER_ADMIN">;
}

// ─── Shared ──────────────────────────────────────────────────────────────────

export interface IUserFilterPayload {
    email?: string;
    name?: string;
    role?: Role;
    isDeleted?: boolean;
}