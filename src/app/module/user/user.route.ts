import { Router } from "express";
import { Role } from "../../../generated/prisma";
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
 * Both ADMIN and SUPER_ADMIN can reach this route.
 * The service layer enforces that only SUPER_ADMIN may assign SUPER_ADMIN.
 */
router.post(
    "/create-admin",
    checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
    validateRequest(createAdminZodSchema),
    UserController.createAdmin,
);

export const UserRoutes = router;