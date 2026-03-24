import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { IRequestUser } from "../auth/auth.interface";
import { CommentService } from "./comment.service";

/**
 * POST /comments
 * Creates a top-level comment OR a reply.
 *
 * Body: { noteId, content, parentId? }
 *   - parentId absent  → top-level comment
 *   - parentId present → reply to that comment (one level deep only)
 *
 * userId always comes from the JWT.
 */
const createComment = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;

  const result = await CommentService.createComment({
    userId: user.userId,
    noteId: req.body.noteId,
    content: req.body.content,
    parentId: req.body.parentId,
  });

  const message = req.body.parentId
    ? "Reply added successfully"
    : "Comment added successfully";

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message,
    data: result,
  });
});

/**
 * GET /comments/:noteId
 * Returns top-level comments with nested replies.
 * Each comment/reply includes likeCount and isLikedByMe.
 */
const getCommentsByNote = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;

  const result = await CommentService.getCommentsByNote({
    userId: user.userId,
    noteId: req.params.noteId as string,
  });

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Comments fetched successfully",
    data: result,
  });
});

/**
 * DELETE /comments/:commentId
 * Comment owner OR ADMIN/SUPER_ADMIN.
 * Deleting a top-level comment also removes all its replies (cascade).
 */
const deleteComment = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;

  const result = await CommentService.deleteComment({
    userId: user.userId,
    userRole: user.role,
    commentId: req.params.commentId as string,
  });

  const message = result.wasReply
    ? "Reply deleted successfully"
    : `Comment deleted along with ${result.deletedRepliesCount} reply/replies`;

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message,
    data: result,
  });
});

/**
 * POST /comments/:commentId/like
 * Toggle like on a comment or reply.
 * Returns { isLiked, commentId, likeCount } — no refetch needed.
 */
const toggleCommentLike = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;

  const result = await CommentService.toggleCommentLike({
    userId: user.userId,
    commentId: req.params.commentId as string,
  });

  const message = result.isLiked
    ? "Comment liked"
    : "Comment unliked";

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message,
    data: result,
  });
});

// ─── Exports ──────────────────────────────────────────────────────────────────

export const CommentController = {
  createComment,
  getCommentsByNote,
  deleteComment,
  toggleCommentLike,
};