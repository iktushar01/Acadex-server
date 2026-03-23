import { Router } from "express";
import { Role } from "../../../generated/prisma";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { upload, memoryUpload } from "../../../config/multer.config";
import { createNoteZodSchema } from "./notes.validation";
import { NoteController } from "./notes.controller";

const router = Router();

/**
 * Authorization model:
 *
 *   Global checkAuth      → confirms valid JWT (user is logged in)
 *   multer upload         → processes files into memory (req.files)
 *   validateRequest       → validates text body fields (Zod)
 *   Classroom membership  → checked inside the SERVICE via Membership table
 */

/**
 * POST /notes
 * Accepts up to 10 files via the "files" field (multipart/form-data).
 * Body fields: title, classroomId, subjectId, folderId?
 */
router.post(
  "/",
  checkAuth(Role.STUDENT, Role.ADMIN, Role.SUPER_ADMIN),
  memoryUpload.array("files", 10), // multer parses multipart into memory
  validateRequest(createNoteZodSchema),
  NoteController.createNote,
);

/**
 * GET /notes?subjectId=xxx&folderId=yyy
 * STUDENT → APPROVED only
 * CR      → all statuses
 */
router.get(
  "/",
  checkAuth(Role.STUDENT, Role.ADMIN, Role.SUPER_ADMIN),
  NoteController.getNotes,
);

/**
 * PATCH /notes/:id/approve
 * CR only — approves a PENDING note.
 *
 * ⚠️  Must be defined BEFORE /:id to avoid "approve" being parsed as a noteId.
 */
router.patch(
  "/:id/approve",
  checkAuth(Role.STUDENT, Role.ADMIN, Role.SUPER_ADMIN),
  NoteController.approveNote,
);

/**
 * PATCH /notes/:id/reject
 * CR only — rejects a PENDING note.
 *
 * ⚠️  Also before /:id for the same reason.
 */
router.patch(
  "/:id/reject",
  checkAuth(Role.STUDENT, Role.ADMIN, Role.SUPER_ADMIN),
  NoteController.rejectNote,
);

/**
 * DELETE /notes/:id
 * Uploader OR CR — deletes note, NoteFiles, and Cloudinary assets.
 */
router.delete(
  "/:id",
  checkAuth(Role.STUDENT, Role.ADMIN, Role.SUPER_ADMIN),
  NoteController.deleteNote,
);

export const NoteRoutes = router;