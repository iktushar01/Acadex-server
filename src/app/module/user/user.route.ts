import { Router } from "express";
import { Role } from "../../../generated/prisma";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { UserController } from "./user.controller";
import {
    approveCRApplicationZodSchema,
    createAdminZodSchema,
    createCRApplicationZodSchema,
    createStudentZodSchema,
} from "./user.validation";

const router = Router();

// ─── Public ──────────────────────────────────────────────────────────────────

/**
 * POST /users/create-student
 * Open registration — no auth required.
 */
router.post(
    "/create-student",
    validateRequest(createStudentZodSchema),
    UserController.createStudent,
);

// ─── Authenticated Student ───────────────────────────────────────────────────

/**
 * POST /users/apply-cr
 * Any verified STUDENT may apply to become a CR.
 */
router.post(
    "/apply-cr",
    checkAuth(Role.STUDENT, Role.CR),   // CR can re-apply for a different semester
    validateRequest(createCRApplicationZodSchema),
    UserController.applyCRRole,
);

// ─── Admin / Super Admin ─────────────────────────────────────────────────────

/**
 * POST /users/create-admin
 * Both ADMIN and SUPER_ADMIN can hit this route.
 * The service layer enforces that only SUPER_ADMIN can assign SUPER_ADMIN.
 */
router.post(
    "/create-admin",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    validateRequest(createAdminZodSchema),
    UserController.createAdmin,
);

/**
 * PATCH /users/cr-applications/:applicationId/approve
 */
router.patch(
    "/cr-applications/:applicationId/approve",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    validateRequest(approveCRApplicationZodSchema),
    UserController.approveCRApplication,
);

/**
 * PATCH /users/cr-applications/:applicationId/reject
 */
router.patch(
    "/cr-applications/:applicationId/reject",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    UserController.rejectCRApplication,
);

export const UserRoutes = router;