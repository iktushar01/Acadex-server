import { Router } from "express";
import { Role } from "../../../generated/prisma";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { ClassroomController } from "./classroom.controller";
import { checkClassroomMember } from "./classroom.middleware";
import {
  classroomFilterZodSchema,
  createClassroomZodSchema,
  joinClassroomZodSchema,
  rejectClassroomZodSchema,
} from "./classroom.validation";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT routes
// Global role check only — no classroom membership needed here because
// these are "before joining" or "own data" actions.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /classrooms
 * Submit a new classroom creation request.
 */
router.post(
  "/",
  checkAuth(Role.STUDENT, Role.SUPER_ADMIN),
  validateRequest(createClassroomZodSchema),
  ClassroomController.createClassroom,
);

/**
 * POST /classrooms/join
 * Join an approved classroom using a code.
 */
router.post(
  "/join",
  checkAuth(Role.STUDENT, Role.SUPER_ADMIN),
  validateRequest(joinClassroomZodSchema),
  ClassroomController.joinClassroom,
);

/**
 * GET /classrooms/my-memberships
 * All classrooms the current user belongs to (with per-classroom role).
 *
 * ⚠️  Must be defined BEFORE /:classroomId so Express does not interpret
 *    the literal string "my-memberships" as a classroomId param.
 */
router.get(
  "/my-memberships",
  checkAuth(Role.STUDENT, Role.SUPER_ADMIN),
  ClassroomController.getMyClassrooms,
);

router.get(
  "/leaderboard",
  checkAuth(Role.STUDENT, Role.SUPER_ADMIN),
  ClassroomController.getMyClassroomLeaderboard,
);

router.get(
  "/:classroomId/leaderboard",
  checkAuth(Role.STUDENT, Role.ADMIN, Role.SUPER_ADMIN),
  checkClassroomMember(),
  ClassroomController.getClassroomLeaderboardById,
);

/**
 * GET /classrooms/my-requests
 * All classroom creation requests submitted by this student.
 *
 * ⚠️  Also before /:classroomId for the same reason.
 */
router.get(
  "/my-requests",
  checkAuth(Role.STUDENT, Role.SUPER_ADMIN),
  ClassroomController.getMyClassroomRequests,
);

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN routes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /classrooms
 * Paginated list with filters — use ?status=PENDING for the approval queue.
 */
router.get(
  "/",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(classroomFilterZodSchema, "query"),
  ClassroomController.getClassrooms,
);

/**
 * PATCH /classrooms/:classroomId/approve
 * Approve → sets status=APPROVED and creates CR membership atomically.
 */
router.patch(
  "/:classroomId/approve",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  ClassroomController.approveClassroom,
);

/**
 * PATCH /classrooms/:classroomId/reject
 * Reject with a required reason.
 */
router.patch(
  "/:classroomId/reject",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(rejectClassroomZodSchema),
  ClassroomController.rejectClassroom,
);

// ─────────────────────────────────────────────────────────────────────────────
// SHARED — dynamic param route MUST come last
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /classrooms/:classroomId
 * Single classroom detail. Accessible to admins and classroom members.
 */
router.get(
  "/:classroomId",
  checkAuth(Role.STUDENT, Role.ADMIN, Role.SUPER_ADMIN),
  ClassroomController.getClassroomById,
);

export const ClassroomRoutes = router;
