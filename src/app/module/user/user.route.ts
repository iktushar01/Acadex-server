import { Router } from "express";
import { Role } from "../../../generated/prisma";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { UserController } from "./user.controller";
import {
    approveCRApplicationZodSchema,
    createAdminZodSchema,
    createCRApplicationZodSchema,
} from "./user.validation";

const router = Router();

// ─── Admin provisioning ───────────────────────────────────────────────────────

/**
 * POST /users/create-admin
 * Both ADMIN and SUPER_ADMIN can reach this route.
 * The service layer enforces that only SUPER_ADMIN may assign SUPER_ADMIN.
 */
router.post(
    "/create-admin",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    validateRequest(createAdminZodSchema),
    UserController.createAdmin,
);

// ─── CR application flow ──────────────────────────────────────────────────────

/**
 * POST /users/apply-cr
 * Any verified STUDENT (or existing CR applying for a different semester) may apply.
 */
router.post(
    "/apply-cr",
    checkAuth(Role.STUDENT, Role.CR),
    validateRequest(createCRApplicationZodSchema),
    UserController.applyCRRole,
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