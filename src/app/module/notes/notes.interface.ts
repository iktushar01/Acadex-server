import { NoteStatus } from "../../../generated/prisma";

// ─── Uploaded file shape ──────────────────────────────────────────────────────

/**
 * Shape of each processed file after multer-storage-cloudinary runs.
 * `path` is the Cloudinary URL (set by CloudinaryStorage).
 * `mimetype` is used to determine whether the file is a PDF or image.
 */
export interface IUploadedFile {
  path: string;       // Cloudinary URL
  originalname: string;
  mimetype: string;
  size: number;       // bytes
}

// ─── Create ───────────────────────────────────────────────────────────────────

export interface ICreateNotePayload {
  /** Resolved from JWT — never from request body */
  uploadedBy: string;
  title: string;
  description?: string;
  classroomId: string;
  subjectId: string;
  folderId?: string;
  /** Processed by multer + Cloudinary before reaching the service */
  files: IUploadedFile[];
}

// ─── Get ──────────────────────────────────────────────────────────────────────

export interface IGetNotesPayload {
  /** Resolved from JWT */
  userId: string;
  /** Raw express query object for QueryBuilder */
  query: Record<string, any>;
}

export interface IGetNoteByIdPayload {
  /** Resolved from JWT */
  userId: string;
  noteId: string;
}

// ─── Approve / Reject ─────────────────────────────────────────────────────────

export interface IApproveNotePayload {
  /** Resolved from JWT */
  userId: string;
  noteId: string;
}

export interface IRejectNotePayload {
  /** Resolved from JWT */
  userId: string;
  noteId: string;
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export interface IDeleteNotePayload {
  /** Resolved from JWT */
  userId: string;
  noteId: string;
}

// ─── Membership context returned by auth helpers ──────────────────────────────

export interface IMembershipContext {
  role: string;
  classroomId: string;
}
