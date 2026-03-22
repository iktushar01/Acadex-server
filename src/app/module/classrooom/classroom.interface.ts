import { ClassroomStatus, InstitutionLevel, MembershipRole } from "../../../generated/prisma";

// ─── Create ───────────────────────────────────────────────────────────────────

export interface ICreateClassroomPayload {
  /** Always resolved from JWT — never accepted from request body */
  createdBy: string;
  name: string;
  institutionName: string;
  level: InstitutionLevel;
  className?: string;   // e.g. "Class 9", "1st Year"
  department?: string;  // e.g. "Computer Science"
  groupName?: string;   // e.g. "Science", "Commerce"
  description?: string;
}

// ─── Admin actions ────────────────────────────────────────────────────────────

export interface IApproveClassroomPayload {
  classroomId: string;
  /** Resolved from the admin's JWT */
  resolvedBy: string;
}

export interface IRejectClassroomPayload {
  classroomId: string;
  resolvedBy: string;
  rejectionReason: string;
}

// ─── Query filters ────────────────────────────────────────────────────────────

export interface IClassroomFilterPayload {
  status?: ClassroomStatus;
  institutionName?: string;
  name?: string;
  level?: InstitutionLevel;
  page?: number;
  limit?: number;
}

// ─── Per-classroom role context ───────────────────────────────────────────────

/**
 * Attached to req.classroomMember by checkClassroomRole middleware.
 * Controllers read this instead of re-querying the DB.
 */
export interface IClassroomMemberContext {
  userId: string;
  classroomId: string;
  memberRole: MembershipRole;
}