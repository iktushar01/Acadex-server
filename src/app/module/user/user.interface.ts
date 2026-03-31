import type { Role } from "../../lib/prisma-exports";

// ─── Admin ────────────────────────────────────────────────────────────────────

export interface IAdminCore {
    name: string;
    email: string;
    profilePhoto?: string;
    contactNumber?: string;
}

/**
 * Payload for creating an ADMIN or SUPER_ADMIN user.
 *
 * Role-elevation rules (enforced in service layer):
 *  - SUPER_ADMIN → may create ADMIN or SUPER_ADMIN
 *  - ADMIN       → may only create ADMIN
 *
 * Super admin bootstrapping is handled by a seed script, not this endpoint.
 */
export interface ICreateAdminPayload {
    password: string;
    admin: IAdminCore;
    role: Extract<Role, "ADMIN" | "SUPER_ADMIN">;
}


// ─── Shared ───────────────────────────────────────────────────────────────────

export interface IUserFilterPayload {
    email?: string;
    name?: string;
    role?: Role;
    isDeleted?: boolean;
}
