// ─── Comment ──────────────────────────────────────────────────────────────────

export interface ICreateCommentPayload {
  /** Resolved from JWT — never from request body */
  userId: string;
  noteId: string;
  content: string;
  /**
   * If provided, this is a reply to an existing top-level comment.
   * Replies to replies are not allowed — enforced in service.
   */
  parentId?: string;
}

export interface IGetCommentsPayload {
  /** Resolved from JWT */
  userId: string;
  noteId: string;
}

export interface IDeleteCommentPayload {
  /** Resolved from JWT */
  userId: string;
  /** Global role from JWT — used to check ADMIN/SUPER_ADMIN privilege */
  userRole: string;
  commentId: string;
}

// ─── Like ─────────────────────────────────────────────────────────────────────

export interface IToggleCommentLikePayload {
  /** Resolved from JWT */
  userId: string;
  commentId: string;
}

export interface IToggleCommentLikeResult {
  isLiked: boolean;
  commentId: string;
  likeCount: number;
}