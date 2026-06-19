import { Router } from "express";
import { Role } from "../../lib/prisma-exports";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { ChatbotController } from "./chatbot.controller";
import {
  askChatbotZodSchema,
  classroomIdParamSchema,
} from "./chatbot.validation";

const router = Router();

router.post(
  "/ask",
  checkAuth(Role.STUDENT, Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(askChatbotZodSchema),
  ChatbotController.askChatbot,
);

router.get(
  "/history/:classroomId",
  checkAuth(Role.STUDENT, Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(classroomIdParamSchema, "params"),
  ChatbotController.getChatHistory,
);

router.post(
  "/reindex/:classroomId",
  checkAuth(Role.STUDENT, Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(classroomIdParamSchema, "params"),
  ChatbotController.reindexClassroom,
);

export const ChatbotRoutes = router;
