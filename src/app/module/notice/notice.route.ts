import { Router } from "express";
import { Role } from "../../lib/prisma-exports";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { NoticeController } from "./notice.controller";
import { toggleNoticeZodSchema, upsertNoticeZodSchema } from "./notice.validation";

const router = Router();

router.get(
  "/current",
  checkAuth(Role.STUDENT, Role.ADMIN, Role.SUPER_ADMIN),
  NoticeController.getCurrentNotice,
);

router.patch(
  "/current",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(upsertNoticeZodSchema),
  NoticeController.upsertNotice,
);

router.patch(
  "/current/toggle",
  checkAuth(Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(toggleNoticeZodSchema),
  NoticeController.toggleNotice,
);

export const NoticeRoutes = router;
