import { Router } from "express";
import { Role } from "../../lib/prisma-exports";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { memoryUpload } from "../../../config/multer.config";
import { AuthController } from "./auth.controller";
import { 
    registerStudentZodSchema,
    loginZodSchema,
    verifyEmailZodSchema,
    forgetPasswordZodSchema,
    resetPasswordZodSchema,
 changePasswordZodSchema,
    updateProfileZodSchema,
 } from "./auth.validation";



const router = Router();

// ─── Public routes ────────────────────────────────────────────────────────────

router.post(
    "/register",
    memoryUpload.single("image"),
    validateRequest(registerStudentZodSchema),
    AuthController.registerStudent,
);

router.post(
    "/login",
    validateRequest(loginZodSchema),
    AuthController.loginUser,
);

router.post("/refresh-token", AuthController.getNewTokens);

router.post(
    "/verify-email",
    validateRequest(verifyEmailZodSchema),
    AuthController.verifyEmail,
);

router.post(
    "/forget-password",
    validateRequest(forgetPasswordZodSchema),
    AuthController.forgetPassword,
);

router.post(
    "/reset-password",
    validateRequest(resetPasswordZodSchema),
    AuthController.resetPassword,
);

// ─── Google OAuth ─────────────────────────────────────────────────────────────

router.get("/login/google", AuthController.googleLogin);
router.get("/google/success", AuthController.googleLoginSuccess);
router.get("/oauth/error", AuthController.handleOAuthError);

// ─── Authenticated routes (all roles) ────────────────────────────────────────

const allRoles = [Role.STUDENT, Role.ADMIN, Role.SUPER_ADMIN] as const;

router.get("/me", checkAuth(...allRoles), AuthController.getMe);

router.patch(
    "/me",
    checkAuth(...allRoles),
    memoryUpload.single("image"),
    validateRequest(updateProfileZodSchema),
    AuthController.updateProfile,
);

router.post(
    "/change-password",
    checkAuth(...allRoles),
    validateRequest(changePasswordZodSchema),
    AuthController.changePassword,
);

router.post("/logout", checkAuth(...allRoles), AuthController.logoutUser);

export const AuthRoute = router;
