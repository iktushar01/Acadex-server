// ─── Create ───────────────────────────────────────────────────────────────────

export interface ICreateFolderPayload {
  /** Resolved from JWT — never accepted from request body */
  userId: string;
  name: string;
  coverImage?: string;  // Explicit URL
  coverImageBase64?: string; // Base64 for upload
  subjectId: string;
}

// ─── Update ───────────────────────────────────────────────────────────────────

export interface IUpdateFolderPayload {
  /** Resolved from JWT */
  userId: string;
  /** Route param */
  folderId: string;
  name?: string;
  coverImage?: string | null;  // null = explicitly remove the cover image
  coverImageBase64?: string;
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export interface IDeleteFolderPayload {
  /** Resolved from JWT */
  userId: string;
  folderId: string;
}

// ─── Query ────────────────────────────────────────────────────────────────────

export interface IGetFoldersPayload {
  /** Resolved from JWT */
  userId: string;
  subjectId: string;
}