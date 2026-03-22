import { Router } from "express";
import { Role } from "../../../generated/prisma";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { SubjectController } from "./subject.controller";
import {
  createSubjectZodSchema,
  updateSubjectZodSchema,
} from "./subject.validation";

const router = Router();

/**
 * Authorization model for this module:
 *
 *   Global checkAuth  — confirms the user is logged in and their JWT is valid.
 *   Classroom membership — checked inside the SERVICE via the Membership table.
 *
 * Why service-layer auth (not middleware)?
 *   - POST and GET supply classroomId in the body / query, not a URL param.
 *   - PATCH and DELETE resolve classroomId from the subject record itself.
 *   - The existing checkClassroomRole middleware only reads req.params.classroomId.
 *   - Centralising the check in assertClassroomAccess() means one place to audit.
 *
 * All four endpoints are accessible to any authenticated user (STUDENT role).
 * The service then checks whether the user is actually a member / CR of the
 * specific classroom involved.
 */

/**
 * POST /subjects
 * Body: { name, classroomId }
 * Only the CR of the target classroom may call this.
 */
router.post(
  "/",
  checkAuth(Role.STUDENT, Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(createSubjectZodSchema),
  SubjectController.createSubject,
);

/**
 * GET /subjects?classroomId=xxx
 * Any member (STUDENT or CR) of the classroom may call this.
 * classroomId is a required query param validated inside the service.
 */
router.get(
  "/",
  checkAuth(Role.STUDENT, Role.ADMIN, Role.SUPER_ADMIN),
  SubjectController.getSubjectsByClassroom,
);

/**
 * PATCH /subjects/:id
 * Body: { name }
 * Only the CR of the subject's classroom may call this.
 * classroomId is resolved from the subject record inside the service.
 */
router.patch(
  "/:id",
  checkAuth(Role.STUDENT, Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(updateSubjectZodSchema),
  SubjectController.updateSubject,
);

/**
 * DELETE /subjects/:id
 * Only the CR of the subject's classroom may call this.
 * Cascades: deletes all notes belonging to this subject.
 */
router.delete(
  "/:id",
  checkAuth(Role.STUDENT, Role.ADMIN, Role.SUPER_ADMIN),
  SubjectController.deleteSubject,
);

export const SubjectRoutes = router;