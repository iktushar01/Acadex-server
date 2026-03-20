import { Router } from "express";
import { AuthController } from "./auth.controller";
import { checkAuth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma";

const router = Router();

router.post("/register", AuthController.registerStudent);
router.post("/login", AuthController.loginUser);
router.get("/me", checkAuth(Role.STUDENT, Role.CR, Role.ADMIN), AuthController.getMe);
router.post("/refresh-token", AuthController.getNewTokens);
router.post("/change-password", checkAuth(Role.STUDENT, Role.CR, Role.ADMIN), AuthController.changePassword);
router.post("/logout", checkAuth(Role.STUDENT, Role.CR, Role.ADMIN), AuthController.logoutUser);
router.post("/verify-email", AuthController.verifyEmail);
router.post("/forget-password", AuthController.forgetPassword);
router.post("/reset-password", AuthController.resetPassword);

router.get("/login/google", AuthController.googleLogin);
router.get("/google/success", AuthController.googleLoginSuccess);
router.get("/oauth/error", AuthController.handleOAuthError);

export const AuthRoute = router; 