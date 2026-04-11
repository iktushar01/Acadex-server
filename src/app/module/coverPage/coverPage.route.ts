import { Router } from "express";
import { Role } from "../../lib/prisma-exports";
import { checkAuth } from "../../middleware/checkAuth";
import { memoryUpload } from "../../../config/multer.config";
import { CoverPageController } from "./coverPage.controller";

const router = Router();

router.post(
    "/logo",
    checkAuth(Role.STUDENT, Role.ADMIN, Role.SUPER_ADMIN),
    memoryUpload.single("logo"),
    CoverPageController.uploadLogo,
);

export const CoverPageRoutes = router;
