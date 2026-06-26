import { Router } from "express";
import { Role } from "../../lib/prisma-exports";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { ChatbotController } from "./chatbot.controller";
import {
  askChatbotZodSchema,
  classroomIdParamSchema,
  createSessionZodSchema,
  noteIdParamSchema,
  sessionIdParamSchema,
} from "./chatbot.validation";

const router = Router();

router.post(
  "/ask",
  checkAuth(Role.STUDENT, Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(askChatbotZodSchema),
  ChatbotController.askChatbot,
);

router.post(
  "/ask/stream",
  checkAuth(Role.STUDENT, Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(askChatbotZodSchema),
  ChatbotController.askChatbotStream,
);

router.get(
  "/history/:classroomId",
  checkAuth(Role.STUDENT, Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(classroomIdParamSchema, "params"),
  ChatbotController.getChatHistory,
);

router.get(
  "/sessions/:classroomId",
  checkAuth(Role.STUDENT, Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(classroomIdParamSchema, "params"),
  ChatbotController.listSessions,
);

router.post(
  "/sessions",
  checkAuth(Role.STUDENT, Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(createSessionZodSchema),
  ChatbotController.createSession,
);

router.delete(
  "/sessions/:sessionId/clear",
  checkAuth(Role.STUDENT, Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(sessionIdParamSchema, "params"),
  ChatbotController.clearSession,
);

router.post(
  "/reindex/:classroomId",
  checkAuth(Role.STUDENT, Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(classroomIdParamSchema, "params"),
  ChatbotController.reindexClassroom,
);

router.post(
  "/reindex/note/:noteId",
  checkAuth(Role.STUDENT, Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(noteIdParamSchema, "params"),
  ChatbotController.reindexNote,
);

router.get(
  "/admin/stats/:classroomId",
  checkAuth(Role.STUDENT, Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(classroomIdParamSchema, "params"),
  ChatbotController.getClassroomIndexStats,
);

export const ChatbotRoutes = router;
