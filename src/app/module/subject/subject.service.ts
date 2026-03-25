import { ClassroomStatus, MembershipRole } from "../../../generated/prisma";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { StatusCodes } from "http-status-codes";
import { uploadToImgbb } from "../../utils/uploadImg";
import {
  ICreateSubjectPayload,
  IDeleteSubjectPayload,
  IGetSubjectsPayload,
  IUpdateSubjectPayload,
} from "./subject.interface";

// ─── Shared select ────────────────────────────────────────────────────────────

/**
 * Public shape returned for every subject response.
 * _count exposes how many notes exist — useful for the frontend to show
 * whether a subject has content before a user clicks into it.
 */
const subjectSelect = {
  id: true,
  name: true,
  coverImage: true,
  classroomId: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: { notes: true },
  },
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolves and validates classroom membership in one query.
 *
 * Checks (in order):
 *   1. Classroom exists
 *   2. Classroom is APPROVED (active)
 *   3. User has a Membership row for this classroom
 *   4. User's membership role matches one of the allowedRoles
 *
 * Called at the top of every service function — all auth for this module
 * lives here, not in middleware, because classroomId comes from the body /
 * query / a related record rather than always being a URL param.
 */
const assertClassroomAccess = async (
  userId: string,
  classroomId: string,
  allowedRoles: MembershipRole[],
): Promise<void> => {
  // Single query: get classroom status and the user's membership in one shot
  const classroom = await prisma.classroom.findUnique({
    where: { id: classroomId },
    select: {
      id: true,
      status: true,
      memberships: {
        where: { userId },
        select: { role: true },
        take: 1,
      },
    },
  });

  if (!classroom) {
    throw new AppError(StatusCodes.NOT_FOUND, "Classroom not found");
  }

  if (classroom.status !== ClassroomStatus.APPROVED) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      "This classroom is not yet active",
    );
  }

  const membership = classroom.memberships[0];

  if (!membership) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      "You are not a member of this classroom",
    );
  }

  if (!allowedRoles.includes(membership.role)) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      "Only the Class Representative can perform this action",
    );
  }
};

/**
 * Case-insensitive duplicate check: "Math" and "math" cannot coexist in the
 * same classroom. An optional `excludeId` allows update to skip the subject
 * being renamed.
 */
const assertNoDuplicateName = async (
  name: string,
  classroomId: string,
  excludeId?: string,
): Promise<void> => {
  const duplicate = await prisma.subject.findFirst({
    where: {
      classroomId,
      name: { equals: name, mode: "insensitive" },
      ...(excludeId && { NOT: { id: excludeId } }),
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new AppError(
      StatusCodes.CONFLICT,
      `A subject named "${name}" already exists in this classroom`,
    );
  }
};

// ─── Create ───────────────────────────────────────────────────────────────────

/**
 * Creates a new subject inside a classroom.
 *
 * Guards:
 *   - Caller must be CR of that classroom (checked via Membership table)
 *   - Subject name must be unique within the classroom (case-insensitive)
 */
const createSubject = async (payload: ICreateSubjectPayload) => {
  const { userId, name, classroomId, coverImageBase64, coverImage: providedUrl } = payload;

  // 1. Verify caller is CR of this classroom
  await assertClassroomAccess(userId, classroomId, [MembershipRole.CR]);

  // 2. Prevent duplicate names
  await assertNoDuplicateName(name, classroomId);

  // 3. Upload cover image if base64 provided, else use provided URL
  let coverImage: string | undefined = providedUrl;
  if (coverImageBase64) {
    coverImage = await uploadToImgbb(coverImageBase64);
  }

  // 4. Create subject
  return prisma.subject.create({
    data: { name, classroomId, coverImage },
    select: subjectSelect,
  });
};

// ─── Get subjects by classroom ────────────────────────────────────────────────

/**
 * Returns all subjects for a classroom, sorted newest first.
 *
 * Guards:
 *   - Caller must be any member (STUDENT or CR) of the classroom
 */
const getSubjectsByClassroom = async (payload: IGetSubjectsPayload) => {
  const { userId, classroomId } = payload;

  // Any member (STUDENT or CR) may read subjects
  await assertClassroomAccess(userId, classroomId, [
    MembershipRole.STUDENT,
    MembershipRole.CR,
  ]);

  return prisma.subject.findMany({
    where: { classroomId },
    select: subjectSelect,
    orderBy: { createdAt: "desc" },
  });
};

// ─── Update ───────────────────────────────────────────────────────────────────

/**
 * Renames a subject.
 *
 * Guards:
 *   - Caller must be CR of the subject's classroom
 *   - New name must not conflict with another subject in the same classroom
 *
 * classroomId is resolved from the subject record itself — the caller does
 * not need to supply it, which prevents spoofing.
 */
const updateSubject = async (payload: IUpdateSubjectPayload) => {
  const { userId, subjectId, name, coverImageBase64 } = payload;

  // Resolve classroomId from the subject
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    select: { id: true, classroomId: true, name: true },
  });

  if (!subject) {
    throw new AppError(StatusCodes.NOT_FOUND, "Subject not found");
  }

  // Verify caller is CR
  await assertClassroomAccess(userId, subject.classroomId, [MembershipRole.CR]);

  // Prevent duplicate names
  if (name) {
    await assertNoDuplicateName(name, subject.classroomId, subjectId);
  }

  // Handle new cover image: prioritize base64 if provided, else use provided URL
  let coverImage: string | undefined = payload.coverImage;
  if (coverImageBase64) {
    coverImage = await uploadToImgbb(coverImageBase64);
  }

  return prisma.subject.update({
    where: { id: subjectId },
    data: { 
      name,
      coverImage
    },
    select: subjectSelect,
  });
};

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * Deletes a subject and all its notes (cascade).
 *
 * Strategy: cascade — deleting a subject removes its notes atomically.
 * Rationale: a subject is the organisational container for notes; a
 * subject without notes (or with notes that must be manually removed first)
 * creates a frustrating UX for the CR. Notes that belonged to a deleted
 * subject have no useful context, so removing them together is correct.
 *
 * Guards:
 *   - Caller must be CR of the subject's classroom
 *
 * Transaction guarantees notes + subject are deleted together or not at all.
 */
const deleteSubject = async (payload: IDeleteSubjectPayload) => {
  const { userId, subjectId } = payload;

  // Resolve classroomId from the subject
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    select: {
      id: true,
      classroomId: true,
      name: true,
      _count: { select: { notes: true } },
    },
  });

  if (!subject) {
    throw new AppError(StatusCodes.NOT_FOUND, "Subject not found");
  }

  // Verify caller is CR of this subject's classroom
  await assertClassroomAccess(userId, subject.classroomId, [MembershipRole.CR]);

  // Delete notes first, then the subject — enforces referential integrity
  // even if the schema does not have onDelete: Cascade set on Note.subjectId
  await prisma.$transaction([
    prisma.note.deleteMany({ where: { subjectId } }),
    prisma.subject.delete({ where: { id: subjectId } }),
  ]);

  return {
    id: subject.id,
    name: subject.name,
    deletedNotesCount: subject._count.notes,
  };
};

// ─── Exports ──────────────────────────────────────────────────────────────────

export const SubjectService = {
  createSubject,
  getSubjectsByClassroom,
  updateSubject,
  deleteSubject,
};