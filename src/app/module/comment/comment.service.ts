import { ClassroomStatus, NoteStatus, Role } from "../../lib/prisma-exports";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { StatusCodes } from "http-status-codes";
import {
  ICreateCommentPayload,
  IDeleteCommentPayload,
  IGetCommentsPayload,
  IToggleCommentLikePayload,
  IToggleCommentLikeResult,
} from "./comment.interface";

// ─── Shared select shapes ─────────────────────────────────────────────────────

/**
 * Minimal user shape shown on every comment and reply.
 */
const commentUserSelect = {
  id: true,
  name: true,
  image: true,
} as const;

/**
 * Shape of a reply (no nested replies — one level deep only).
 * Like count and isLikedByMe are injected after the query (see buildCommentView).
 */
const replySelect = {
  id: true,
  content: true,
  noteId: true,
  parentId: true,
  createdAt: true,
  updatedAt: true,
  user: { select: commentUserSelect },
  _count: { select: { likes: true } },
} as const;

/**
 * Shape of a top-level comment including its replies.
 */
const commentSelect = {
  id: true,
  content: true,
  noteId: true,
  parentId: true,
  createdAt: true,
  updatedAt: true,
  user: { select: commentUserSelect },
  _count: { select: { likes: true } },
  replies: {
    select: replySelect,
    orderBy: { createdAt: "asc" as const },
  },
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Validates that a user can interact with a note's comment section.
 *
 * Checks (in order):
 *   1. Note exists
 *   2. Note is APPROVED
 *   3. Classroom is APPROVED
 *   4. User is a member of the classroom
 *
 * Single traversal: note → classroom → memberships[userId]
 * Returns the note so callers have classroomId without a second query.
 */
const assertNoteCommentable = async (userId: string, noteId: string) => {
  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: {
      id: true,
      status: true,
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

  if (!note) {
    throw new AppError(StatusCodes.NOT_FOUND, "Note not found");
  }

  if (note.status !== NoteStatus.APPROVED) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "Cannot comment on an unapproved note",
    );
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

  return note;
};

/**
 * Injects `likeCount` and `isLikedByMe` into a raw comment/reply object.
 *
 * Prisma's `_count.likes` gives the total count. For `isLikedByMe` we
 * pass the caller's liked commentIds as a Set — O(1) lookup per comment
 * instead of one extra query per comment (avoids N+1).
 */
const withLikeInfo = <
  T extends { id: string; _count: { likes: number } },
>(
  item: T,
  likedIds: Set<string>,
): Omit<T, "_count"> & { likeCount: number; isLikedByMe: boolean } => {
  const { _count, ...rest } = item;
  return {
    ...rest,
    likeCount: _count.likes,
    isLikedByMe: likedIds.has(item.id),
  };
};

// ─── Create Comment / Reply ───────────────────────────────────────────────────

/**
 * Creates a top-level comment OR a reply to a top-level comment.
 *
 * Reply rules:
 *   - parentId must point to a real comment on the SAME note
 *   - The parent comment must itself be top-level (parentId = null)
 *     → only ONE level of nesting allowed (Facebook style)
 *   - Replies to replies are rejected with 400
 *
 * Guards:
 *   - Note must be APPROVED
 *   - Caller must be a classroom member
 *   - Content must not be whitespace-only
 */
const createComment = async (payload: ICreateCommentPayload) => {
  const { userId, noteId, content, parentId } = payload;

  // Guard: reject whitespace-only content
  if (!content.trim()) {
    throw new AppError(StatusCodes.BAD_REQUEST, "Comment cannot be empty");
  }

  // Validate note is commentable and caller is a member
  await assertNoteCommentable(userId, noteId);

  // ── Reply validation ─────────────────────────────────────────────────────
  if (parentId) {
    const parentComment = await prisma.comment.findUnique({
      where: { id: parentId },
      select: { id: true, noteId: true, parentId: true },
    });

    if (!parentComment) {
      throw new AppError(StatusCodes.NOT_FOUND, "Parent comment not found");
    }

    // Parent must belong to the same note
    if (parentComment.noteId !== noteId) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        "Parent comment does not belong to this note",
      );
    }

    // Prevent nesting replies inside replies (one level only)
    if (parentComment.parentId !== null) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        "Cannot reply to a reply — only one level of nesting is allowed",
      );
    }
  }

  const comment = await prisma.comment.create({
    data: {
      content: content.trim(),
      noteId,
      userId,
      parentId: parentId ?? null,
    },
    select: commentSelect,
  });

  // New comment has 0 likes, isLikedByMe = false
  return withLikeInfo(
    { ...comment, replies: [] },
    new Set<string>(),
  );
};

// ─── Get Comments ─────────────────────────────────────────────────────────────

/**
 * Returns all TOP-LEVEL comments for a note, each with their replies nested.
 *
 * Response shape per comment:
 * {
 *   id, content, user, createdAt,
 *   likeCount,      ← total likes on this comment
 *   isLikedByMe,    ← did the current user like this comment?
 *   replies: [
 *     { id, content, user, createdAt, likeCount, isLikedByMe }
 *   ]
 * }
 *
 * Single round-trip strategy:
 *   1. Fetch all top-level comments with nested replies + _count.likes
 *   2. Collect ALL commentIds (top-level + all replies) in one pass
 *   3. One query: CommentLike.findMany where userId + commentId IN [...]
 *   4. Build a Set of liked IDs → O(1) lookup per comment/reply
 *
 * This avoids N+1 completely — always 2 DB queries regardless of comment count.
 *
 * Guards:
 *   - Note must be APPROVED
 *   - Caller must be a classroom member
 */
const getCommentsByNote = async (payload: IGetCommentsPayload) => {
  const { userId, noteId } = payload;

  await assertNoteCommentable(userId, noteId);

  // 1. Fetch all top-level comments with replies
  const rawComments = await prisma.comment.findMany({
    where: { noteId, parentId: null }, // top-level only
    select: commentSelect,
    orderBy: { createdAt: "asc" },
  });

  if (rawComments.length === 0) return [];

  // 2. Collect all commentIds (top-level + all replies)
  const allCommentIds: string[] = [];
  for (const c of rawComments) {
    allCommentIds.push(c.id);
    for (const r of c.replies) {
      allCommentIds.push(r.id);
    }
  }

  // 3. Fetch likes in one query
  const userLikes = await prisma.commentLike.findMany({
    where: {
      userId,
      commentId: { in: allCommentIds },
    },
    select: { commentId: true },
  });

  const likedIds = new Set(userLikes.map((l) => l.commentId));

  // 4. Inject likeCount + isLikedByMe into every comment and reply
  return rawComments.map((comment) => ({
    ...withLikeInfo(comment, likedIds),
    replies: comment.replies.map((reply) => withLikeInfo(reply, likedIds)),
  }));
};

// ─── Delete Comment ───────────────────────────────────────────────────────────

/**
 * Deletes a comment or reply.
 *
 * Permitted callers:
 *   - The comment's author
 *   - A global ADMIN or SUPER_ADMIN
 *
 * Cascade behaviour:
 *   - Deleting a top-level comment also deletes all its replies
 *     (onDelete: Cascade on Comment.parentId)
 *   - All CommentLike rows are also cascaded automatically
 */
const deleteComment = async (payload: IDeleteCommentPayload) => {
  const { userId, userRole, commentId } = payload;

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      userId: true,
      noteId: true,
      parentId: true,
      _count: { select: { replies: true } },
    },
  });

  if (!comment) {
    throw new AppError(StatusCodes.NOT_FOUND, "Comment not found");
  }

  const isOwner = comment.userId === userId;
  const isAdmin = userRole === Role.ADMIN || userRole === Role.SUPER_ADMIN;

  if (!isOwner && !isAdmin) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      "You do not have permission to delete this comment",
    );
  }

  await prisma.comment.delete({ where: { id: commentId } });

  return {
    id: comment.id,
    noteId: comment.noteId,
    wasReply: comment.parentId !== null,
    // How many replies were cascade-deleted (0 for replies themselves)
    deletedRepliesCount: comment._count.replies,
  };
};

// ─── Toggle Like ──────────────────────────────────────────────────────────────

/**
 * Toggles a like on a comment or reply.
 *
 * If the user has already liked it → removes the like.
 * If not → adds the like.
 *
 * Guards:
 *   - Comment must exist
 *   - Caller must be a member of the comment's note's classroom
 *     (re-uses assertNoteCommentable via the comment's noteId)
 *
 * Returns the new like state + updated count so the frontend can update
 * the UI immediately without a refetch.
 */
const toggleCommentLike = async (
  payload: IToggleCommentLikePayload,
): Promise<IToggleCommentLikeResult> => {
  const { userId, commentId } = payload;

  // Resolve the comment and its noteId
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, noteId: true },
  });

  if (!comment) {
    throw new AppError(StatusCodes.NOT_FOUND, "Comment not found");
  }

  // Verify the caller is a member of the note's classroom
  await assertNoteCommentable(userId, comment.noteId);

  // Check existing like
  const existing = await prisma.commentLike.findUnique({
    where: { userId_commentId: { userId, commentId } },
    select: { id: true },
  });

  if (existing) {
    // Already liked → remove
    await prisma.commentLike.delete({
      where: { userId_commentId: { userId, commentId } },
    });
  } else {
    // Not yet liked → add
    await prisma.commentLike.create({
      data: { userId, commentId },
    });
  }

  // Return updated count in the same call
  const likeCount = await prisma.commentLike.count({
    where: { commentId },
  });

  return {
    isLiked: !existing,
    commentId,
    likeCount,
  };
};

// ─── Exports ──────────────────────────────────────────────────────────────────

export const CommentService = {
  createComment,
  getCommentsByNote,
  deleteComment,
  toggleCommentLike,
};
