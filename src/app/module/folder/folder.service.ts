import { ClassroomStatus, MembershipRole } from "../../../generated/prisma";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { StatusCodes } from "http-status-codes";
import { uploadToImgbb } from "../../utils/uploadImg";
import {
  ICreateFolderPayload,
  IDeleteFolderPayload,
  IGetFolderByIdPayload,
  IGetFoldersPayload,
  IUpdateFolderPayload,
} from "./folder.interface";

// ─── Shared select ────────────────────────────────────────────────────────────

/**
 * Public shape returned for every folder response.
 * _count.notes tells the frontend how many notes are inside the folder
 */
const folderSelect = {
  id: true,
  name: true,
  coverImage: true,
  subjectId: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
  subject: {
    select: {
      id: true,
      name: true,
      classroomId: true,
    },
  },
  _count: {
    select: { notes: true },
  },
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolves classroomId from a subjectId and validates classroom membership.
 */
const assertSubjectAccess = async (
  userId: string,
  subjectId: string,
  allowedRoles: MembershipRole[],
): Promise<string> => {
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    select: {
      id: true,
      classroomId: true,
      classroom: {
        select: {
          id: true,
          status: true,
          memberships: {
            where: { userId },
            select: { role: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!subject) {
    throw new AppError(StatusCodes.NOT_FOUND, "Subject not found");
  }

  const classroom = subject.classroom;

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

  return classroom.id;
};

/**
 * Resolves access and returns folder details.
 */
const assertFolderAccess = async (
  userId: string,
  folderId: string,
  allowedRoles: MembershipRole[],
) => {
  const folder = await prisma.folder.findUnique({
    where: { id: folderId },
    select: {
      id: true,
      name: true,
      subjectId: true,
      subject: {
        select: {
          id: true,
          classroomId: true,
          classroom: {
            select: {
              id: true,
              status: true,
              memberships: {
                where: { userId },
                select: { role: true },
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  if (!folder) {
    throw new AppError(StatusCodes.NOT_FOUND, "Folder not found");
  }

  const classroom = folder.subject.classroom;

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

  return folder;
};

/**
 * Duplicate check within the same subject.
 */
const assertNoDuplicateName = async (
  name: string,
  subjectId: string,
  excludeId?: string,
): Promise<void> => {
  const duplicate = await prisma.folder.findFirst({
    where: {
      subjectId,
      name: { equals: name, mode: "insensitive" },
      ...(excludeId && { NOT: { id: excludeId } }),
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new AppError(
      StatusCodes.CONFLICT,
      `A folder named "${name}" already exists in this subject`,
    );
  }
};

// ─── Create ───────────────────────────────────────────────────────────────────

const createFolder = async (payload: ICreateFolderPayload) => {
  const { userId, name, coverImage: providedUrl, coverImageBase64, subjectId } = payload;

  // 1. Verify access
  await assertSubjectAccess(userId, subjectId, [MembershipRole.CR]);

  // 2. Duplicate check
  await assertNoDuplicateName(name, subjectId);

  // 3. Handle image
  let coverImage: string | undefined = providedUrl;
  if (coverImageBase64) {
    coverImage = await uploadToImgbb(coverImageBase64);
  }

  // 4. Create
  return prisma.folder.create({
    data: {
      name,
      coverImage: coverImage ?? null,
      subjectId,
      createdBy: userId,
    },
    select: folderSelect,
  });
};

// ─── Get folders ──────────────────────────────────────────────────────────────

const getFoldersBySubject = async (payload: IGetFoldersPayload) => {
  const { userId, subjectId } = payload;

  await assertSubjectAccess(userId, subjectId, [
    MembershipRole.STUDENT,
    MembershipRole.CR,
  ]);

  return prisma.folder.findMany({
    where: { subjectId },
    select: folderSelect,
    orderBy: { createdAt: "desc" },
  });
};

/**
 * Returns one folder by id if the caller is a member of the classroom (STUDENT or CR).
 */
const getFolderById = async (payload: IGetFolderByIdPayload) => {
  const { userId, folderId } = payload;

  const folder = await prisma.folder.findUnique({
    where: { id: folderId },
    select: { subjectId: true },
  });

  if (!folder) {
    throw new AppError(StatusCodes.NOT_FOUND, "Folder not found");
  }

  await assertSubjectAccess(userId, folder.subjectId, [
    MembershipRole.STUDENT,
    MembershipRole.CR,
  ]);

  return prisma.folder.findUniqueOrThrow({
    where: { id: folderId },
    select: folderSelect,
  });
};

// ─── Update ───────────────────────────────────────────────────────────────────

const updateFolder = async (payload: IUpdateFolderPayload) => {
  const { userId, folderId, name, coverImage: providedUrl, coverImageBase64 } = payload;

  const folder = await assertFolderAccess(userId, folderId, [MembershipRole.CR]);

  if (name) {
    await assertNoDuplicateName(name, folder.subjectId, folderId);
  }

  let finalCoverImage: string | undefined | null = providedUrl;
  if (coverImageBase64) {
    finalCoverImage = await uploadToImgbb(coverImageBase64);
  }

  return prisma.folder.update({
    where: { id: folderId },
    data: {
      name,
      ...(finalCoverImage !== undefined && { coverImage: finalCoverImage }),
    },
    select: folderSelect,
  });
};

// ─── Delete ───────────────────────────────────────────────────────────────────

const deleteFolder = async (payload: IDeleteFolderPayload) => {
  const { userId, folderId } = payload;

  const folder = await assertFolderAccess(userId, folderId, [MembershipRole.CR]);

  const noteCount = await prisma.note.count({ where: { folderId } });

  await prisma.$transaction(async (tx) => {
    const folderNotes = await tx.note.findMany({
      where: { folderId },
      select: { id: true },
    });

    const noteIds = folderNotes.map((note) => note.id);

    if (noteIds.length > 0) {
      await tx.noteFile.deleteMany({
        where: { noteId: { in: noteIds } },
      });
    }

    await tx.note.deleteMany({ where: { folderId } });
    await tx.folder.delete({ where: { id: folderId } });
  });

  return {
    id: folder.id,
    name: folder.name,
    deletedNotesCount: noteCount,
  };
};

// ─── Exports ──────────────────────────────────────────────────────────────────

export const FolderService = {
  createFolder,
  getFoldersBySubject,
  getFolderById,
  updateFolder,
  deleteFolder,
};
