import { Router } from "express";
import { Role } from "../../lib/prisma-exports";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { CommentController } from "./comment.controller";
import { createCommentZodSchema } from "./comment.validation";

const router = Router();

/**
 * Route map:
 *
 *   POST   /comments                        → create comment or reply
 *   GET    /comments/:noteId                → get thread for a note
 *   DELETE /comments/:commentId             → delete comment or reply
 *   POST   /comments/:commentId/like        → toggle like on a comment/reply
 *
 * ⚠️  Route ordering:
 *   POST /:commentId/like  MUST be defined before DELETE /:commentId
 *   so Express doesn't try to match "like" as a commentId for DELETE.
 *   (They're different HTTP methods so it's safe, but explicit ordering
 *   avoids future confusion when routes are read top-to-bottom.)
 */

/**
 * POST /comments
 * Body: { noteId, content, parentId? }
 * parentId absent  → new top-level comment
 * parentId present → reply to that comment (one level deep)
 */
router.post(
  "/",
  checkAuth(Role.STUDENT, Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(createCommentZodSchema),
  CommentController.createComment,
);

/**
 * GET /comments/:noteId
 * Returns top-level comments + nested replies with likeCount & isLikedByMe.
 */
router.get(
  "/:noteId",
  checkAuth(Role.STUDENT, Role.ADMIN, Role.SUPER_ADMIN),
  CommentController.getCommentsByNote,
);

/**
 * POST /comments/:commentId/like
 * Toggle like/unlike on any comment or reply.
 * Returns { isLiked, commentId, likeCount }.
 *
 * ⚠️  Defined BEFORE DELETE /:commentId — literal "/like" segment
 *     must not be shadowed by the dynamic /:commentId param.
 *     (Different HTTP verbs here, but conventional to keep literals first.)
 */
router.post(
  "/:commentId/like",
  checkAuth(Role.STUDENT, Role.ADMIN, Role.SUPER_ADMIN),
  CommentController.toggleCommentLike,
);

/**
 * DELETE /comments/:commentId
 * Owner OR ADMIN/SUPER_ADMIN.
 * Deleting a top-level comment cascades to all its replies and likes.
 */
router.delete(
  "/:commentId",
  checkAuth(Role.STUDENT, Role.ADMIN, Role.SUPER_ADMIN),
  CommentController.deleteComment,
);

export const CommentRoutes = router;
