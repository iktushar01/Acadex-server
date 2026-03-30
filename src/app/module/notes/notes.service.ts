import { ClassroomStatus, MembershipRole, NoteStatus } from "../../../generated/prisma";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { StatusCodes } from "http-status-codes";
import { deleteFileFromCloudinary, normalizeCloudinaryUrl } from "../../../config/cloudinary.config";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { 
    ICreateNotePayload,
    IApproveNotePayload,
    IDeleteNotePayload,
    IGetNoteByIdPayload,
    IGetNotesPayload,
    IRejectNotePayload,
    IUploadedFile,
} from "./notes.interface";


// ─── Shared select ────────────────────────────────────────────────────────────

/**
 * Public shape returned for every note response.
 * Always includes the file list and uploader info.
 * Approver info is included so the CR dashboard can show who moderated.
 */
const noteSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  classroomId: true,
  subjectId: true,
  folderId: true,
  uploadedBy: true,
  approvedBy: true,
  createdAt: true,
  updatedAt: true,
  uploader: {
    select: { id: true, name: true, email: true, image: true },
  },
  approver: {
    select: { id: true, name: true, email: true, image: true },
  },
  files: {
    select: {
      id: true,
      url: true,
      type: true,
      fileName: true,
      fileSize: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" as const },
  },
  subject: {
    select: { id: true, name: true },
  },
  folder: {
    select: { id: true, name: true },
  },
} as const;

// ─── Constants ────────────────────────────────────────────────────────────────

const NOTE_SEARCHABLE_FIELDS = ["title", "description"];
const NOTE_FILTERABLE_FIELDS = ["subjectId", "folderId", "status", "uploadedBy"];

const normalizeNoteFiles = <T extends { files?: Array<{ url: string; fileName?: string | null }> }>(note: T): T => ({
  ...note,
  files: note.files?.map((file) => ({
    ...file,
    url: normalizeCloudinaryUrl(file.url, file.fileName),
  })),
});


// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Validates that a user is a member of a classroom and returns their role.
 *
 * Checks (in order):
 *   1. Classroom exists
 *   2. Classroom is APPROVED
 *   3. User has a Membership row
 *
 * Returns the membership role so callers can make role-based decisions.
 * Does NOT enforce a specific role — that is the caller's responsibility.
 */
const assertMembership = async (
  userId: string,
  classroomId: string,
): Promise<MembershipRole> => {
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

  return membership.role;
};

/**
 * Resolves classroomId from a noteId and asserts the caller is a CR of that
 * classroom. Used by approve, reject, and (partially) delete.
 *
 * Returns the full note record with its file URLs so delete can clean up
 * Cloudinary without a second query.
 */
const assertNoteAccessAsCR = async (userId: string, noteId: string) => {
  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: {
      id: true,
      title: true,
      status: true,
      classroomId: true,
      uploadedBy: true,
      files: { select: { id: true, url: true } },
    },
  });

  if (!note) {
    throw new AppError(StatusCodes.NOT_FOUND, "Note not found");
  }

  const role = await assertMembership(userId, note.classroomId);

  if (role !== MembershipRole.CR) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      "Only the Class Representative can perform this action",
    );
  }

  return note;
};

/**
 * Detects file type from MIME type.
 * "pdf" for application/pdf; "image" for everything else (jpeg, png, webp …).
 */
const detectFileType = (mimetype: string): "pdf" | "image" =>
  mimetype.includes("pdf") ? "pdf" : "image";

/**
 * Deletes an array of Cloudinary file URLs.
 * Errors are logged but do not abort the operation — a failed Cloudinary
 * delete should not roll back an otherwise successful DB delete.
 */
/**
 * Deletes an array of Cloudinary files.
 * Errors are logged but do not abort the operation — a failed Cloudinary
 * delete should not roll back an otherwise successful DB delete.
 */
const cleanupCloudinaryFiles = async (
    files: { url: string; type: string }[]
): Promise<void> => {
    await Promise.allSettled(
        files.map((file) => {
            // For Cloudinary 'auto' uploads, 'image' usually covers both images and PDFs.
            // If we later support raw files, we'd use 'raw'.
            const resourceType: "image" | "raw" = file.type === "pdf" ? "image" : "image";

            return deleteFileFromCloudinary(file.url, resourceType).catch((err) =>
                console.error(`[Note] Cloudinary cleanup failed for ${file.url}:`, err)
            );
        })
    );
};

// ─── Create ───────────────────────────────────────────────────────────────────

/**
 * Creates a note with one or more attached files.
 *
 * Guards:
 *   - Caller must be any member (STUDENT or CR) of the classroom
 *   - At least one file must be present (multer guard + service guard)
 *
 * Flow:
 *   1. Assert membership
 *   2. Validate subject belongs to the classroom (prevents cross-classroom injection)
 *   3. Validate folder belongs to the subject (if provided)
 *   4. Create note + NoteFile rows in a single transaction
 *
 * Files arrive as Cloudinary URLs (file.path) after being uploaded in the
 * controller (which processes the memory buffers from multer).
 */
const createNote = async (payload: ICreateNotePayload) => {
  const { uploadedBy, title, description, classroomId, subjectId, folderId, files } =
    payload;

  // 1. Any member may upload
  await assertMembership(uploadedBy, classroomId);

  // 2. Verify subject belongs to this classroom (anti-spoofing)
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    select: { classroomId: true },
  });

  if (!subject) {
    throw new AppError(StatusCodes.NOT_FOUND, "Subject not found");
  }

  if (subject.classroomId !== classroomId) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "Subject does not belong to this classroom",
    );
  }

  // 3. Verify folder belongs to this subject (if provided)
  if (folderId) {
    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
      select: { subjectId: true },
    });

    if (!folder) {
      throw new AppError(StatusCodes.NOT_FOUND, "Folder not found");
    }

    if (folder.subjectId !== subjectId) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        "Folder does not belong to this subject",
      );
    }
  }

  // 4. Guard: at least one file required
  if (!files || files.length === 0) {
    throw new AppError(StatusCodes.BAD_REQUEST, "At least one file is required");
  }

  // 5. Create note + NoteFiles atomically
  return prisma.$transaction(async (tx) => {
    const note = await tx.note.create({
      data: {
        title,
        description: description ?? null,
        classroomId,
        subjectId,
        folderId: folderId ?? null,
        uploadedBy,
        status: NoteStatus.PENDING,
      },
    });

    await tx.noteFile.createMany({
      data: files.map((file: IUploadedFile) => ({
        noteId: note.id,
        url: file.path,                        // Cloudinary URL from multer
        type: detectFileType(file.mimetype),
        fileName: file.originalname,
        fileSize: file.size,
      })),
    });

    // Re-fetch with full select shape (createMany doesn't return records)
    const createdNote = await tx.note.findUniqueOrThrow({
      where: { id: note.id },
      select: noteSelect,
    });

    return normalizeNoteFiles(createdNote);
  });
};

// ─── Get Notes ────────────────────────────────────────────────────────────────

/**
 * Returns notes for a subject (and optionally a folder).
 *
 * Visibility rules:
 *   STUDENT → only APPROVED notes
 *   CR      → all notes (PENDING, APPROVED, REJECTED)
 *
 * Guards:
 *   - Caller must be any member of the classroom
 *
 * classroomId is resolved from subjectId server-side — client never supplies it.
 */
const getNotes = async (payload: IGetNotesPayload) => {
  const { userId, query } = payload;
  const { subjectId } = query;

  if (!subjectId) {
    throw new AppError(StatusCodes.BAD_REQUEST, "subjectId is required to fetch notes");
  }

  // 1. Resolve classroomId and verify membership+active status
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId as string },
    select: {
      classroomId: true,
      classroom: {
        select: {
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

  if (subject.classroom.status !== ClassroomStatus.APPROVED) {
    throw new AppError(StatusCodes.FORBIDDEN, "This classroom is not yet active");
  }

  const membership = subject.classroom.memberships[0];

  if (!membership) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      "You are not a member of this classroom",
    );
  }

  // 2. Build Query
  const isCR = membership.role === MembershipRole.CR;

  const notesQuery = new QueryBuilder(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma.note as any,
    query,
    {
      searchableFields: NOTE_SEARCHABLE_FIELDS,
      filterableFields: NOTE_FILTERABLE_FIELDS,
    },
  )
    .search()
    .filter()
    .where({ subjectId: subjectId as string }) // Force subjectId filter
    // CR sees all statuses; students see only APPROVED by default (unless CR explicitly filters)
    .where(isCR ? {} : { status: NoteStatus.APPROVED })
    .sort()
    .paginate()
    .include(noteSelect.files ? { files: noteSelect.files } : {}) // Files include
    .include({
      uploader: noteSelect.uploader,
      approver: noteSelect.approver,
      subject: noteSelect.subject,
      folder: noteSelect.folder,
    });

  const result = await notesQuery.execute();
  const notes = result.data as Array<{
    files?: Array<{ url: string; fileName?: string | null }>;
  }>;

  return {
    ...result,
    data: notes.map((note) => normalizeNoteFiles(note)),
  };
};

/**
 * Returns a single note for the detail page.
 *
 * Visibility rules match the list page:
 *   STUDENT -> APPROVED notes only
 *   CR      -> all notes in their classroom
 */
const getNoteById = async (payload: IGetNoteByIdPayload) => {
  const { userId, noteId } = payload;

  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: {
      ...noteSelect,
      classroom: {
        select: {
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

  if (!note) {
    throw new AppError(StatusCodes.NOT_FOUND, "Note not found");
  }

  if (note.classroom.status !== ClassroomStatus.APPROVED) {
    throw new AppError(StatusCodes.FORBIDDEN, "This classroom is not yet active");
  }

  const membership = note.classroom.memberships[0];

  if (!membership) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      "You are not a member of this classroom",
    );
  }

  const isCR = membership.role === MembershipRole.CR;

  if (!isCR && note.status !== NoteStatus.APPROVED) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      "You do not have permission to view this note",
    );
  }

  const { classroom, ...noteData } = note;
  return normalizeNoteFiles(noteData);
};

// ─── Approve ──────────────────────────────────────────────────────────────────

/**
 * CR approves a PENDING note.
 *
 * Guards:
 *   - Caller must be CR of the note's classroom
 *   - Note must be in PENDING status
 */
const approveNote = async (payload: IApproveNotePayload) => {
  const { userId, noteId } = payload;

  const note = await assertNoteAccessAsCR(userId, noteId);

  if (note.status !== NoteStatus.PENDING) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `Note is already ${note.status.toLowerCase()}`,
    );
  }

  return prisma.note.update({
    where: { id: noteId },
    data: {
      status: NoteStatus.APPROVED,
      approvedBy: userId,
    },
    select: noteSelect,
  });
};

// ─── Reject ───────────────────────────────────────────────────────────────────

/**
 * CR rejects a PENDING note.
 *
 * Guards:
 *   - Caller must be CR of the note's classroom
 *   - Note must be in PENDING status
 */
const rejectNote = async (payload: IRejectNotePayload) => {
  const { userId, noteId } = payload;

  const note = await assertNoteAccessAsCR(userId, noteId);

  if (note.status !== NoteStatus.PENDING) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `Note is already ${note.status.toLowerCase()}`,
    );
  }

  return prisma.note.update({
    where: { id: noteId },
    data: { status: NoteStatus.REJECTED },
    select: noteSelect,
  });
};

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * Deletes a note and all its NoteFiles, then cleans up Cloudinary.
 *
 * Permission: the note's uploader OR the CR of the classroom may delete.
 *
 * Sequence:
 *   1. Fetch note with file URLs
 *   2. Assert caller is uploader OR CR
 *   3. Delete NoteFiles (referential integrity)
 *   4. Delete Note
 *   5. Clean up Cloudinary (best-effort — DB is source of truth)
 *
 * Cloudinary cleanup uses Promise.allSettled so a failed CDN delete
 * does not roll back the DB deletion.
 */
const deleteNote = async (payload: IDeleteNotePayload) => {
  const { userId, noteId } = payload;

  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: {
      id: true,
      title: true,
      uploadedBy: true,
      classroomId: true,
      files: { select: { id: true, url: true, type: true } },
    },
  });

  if (!note) {
    throw new AppError(StatusCodes.NOT_FOUND, "Note not found");
  }

  // Resolve caller's membership role
  const role = await assertMembership(userId, note.classroomId);

  const isUploader = note.uploadedBy === userId;
  const isCR = role === MembershipRole.CR;

  if (!isUploader && !isCR) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      "You do not have permission to delete this note",
    );
  }

  const filesToDelete = note.files.map((f) => ({
    url: f.url,
    type: f.type,
  }));

  // Delete NoteFiles then Note (order matters for referential integrity)
  await prisma.$transaction([
    prisma.noteFile.deleteMany({ where: { noteId } }),
    prisma.note.delete({ where: { id: noteId } }),
  ]);

  // Best-effort Cloudinary cleanup — does not throw on failure
  await cleanupCloudinaryFiles(filesToDelete);

  return {
    id: note.id,
    title: note.title,
    deletedFilesCount: filesToDelete.length,
  };
};

// ─── Exports ──────────────────────────────────────────────────────────────────

export const NoteService = {
  createNote,
  getNotes,
  getNoteById,
  approveNote,
  rejectNote,
  deleteNote,
};
