import { Router } from "express";
import { Role } from "../../lib/prisma-exports";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { UserController } from "./user.controller";
import {
    createAdminZodSchema,
} from "./user.validation";

const router = Router();

// ─── Admin provisioning ───────────────────────────────────────────────────────

/**
 * POST /users/create-admin
 * Only SUPER_ADMIN can provision admin accounts from the management UI.
 */
router.post(
    "/create-admin",
    checkAuth(Role.SUPER_ADMIN),
    validateRequest(createAdminZodSchema),
    UserController.createAdmin,
);

export const UserRoutes = router;
