import { Router } from "express";
import { Role } from "../../lib/prisma-exports";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { memoryUpload } from "../../../config/multer.config";
import { FolderController } from "./folder.controller";
import {
  createFolderZodSchema,
  updateFolderZodSchema,
} from "./folder.validation";

const router = Router();

/**
 * Authorization model — identical to the subject module:
 *
 *   Global checkAuth  → confirms a valid JWT exists (user is logged in)
 *   Classroom membership → checked inside the SERVICE via Membership table
 *
 * Why service-layer auth?
 *   - POST supplies subjectId in the body → classroomId must be derived
 *     server-side (folder → subject → classroom)
 *   - GET supplies subjectId as a query param → same derivation
 *   - PATCH / DELETE supply only folderId → classroomId derived from
 *     folder → subject → classroom
 *   Using middleware would require a separate DB call before the service
 *   call, duplicating work. The service helpers do it in one query.
 */

/**
 * POST /folders
 * Body: { name, coverImage?, coverImageBase64?, subjectId }
 * Optional file upload via multipart/form-data with field name 'coverImage'
 * Only the CR of the subject's classroom may call this.
 */
router.post(
  "/",
  checkAuth(Role.STUDENT, Role.ADMIN, Role.SUPER_ADMIN),
  memoryUpload.single("coverImage"),
  validateRequest(createFolderZodSchema),
  FolderController.createFolder,
);

/**
 * GET /folders?subjectId=xxx
 * Any member (STUDENT or CR) of the classroom may call this.
 * subjectId is a required query param — validated inside the service.
 */
router.get(
  "/",
  checkAuth(Role.STUDENT, Role.ADMIN, Role.SUPER_ADMIN),
  FolderController.getFoldersBySubject,
);

/**
 * GET /folders/:id
 * Must be registered after GET / so list requests are not captured as an id.
 */
router.get(
  "/:id",
  checkAuth(Role.STUDENT, Role.ADMIN, Role.SUPER_ADMIN),
  FolderController.getFolderById,
);

/**
 * PATCH /folders/:id
 * Body: { name?, coverImage?, coverImageBase64? } — at least one required
 * Optional file upload via multipart/form-data with field name 'coverImage'
 * Only the CR of the folder's classroom may call this.
 */
router.patch(
  "/:id",
  checkAuth(Role.STUDENT, Role.ADMIN, Role.SUPER_ADMIN),
  memoryUpload.single("coverImage"),
  validateRequest(updateFolderZodSchema),
  FolderController.updateFolder,
);

/**
 * DELETE /folders/:id
 * Only the CR of the folder's classroom may call this.
 * Cascades: deletes all notes belonging to this folder.
 */
router.delete(
  "/:id",
  checkAuth(Role.STUDENT, Role.ADMIN, Role.SUPER_ADMIN),
  FolderController.deleteFolder,
);

export const FolderRoutes = router;
