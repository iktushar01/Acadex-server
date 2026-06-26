import { Router } from "express";
import { Role } from "../../lib/prisma-exports";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { ChatController } from "./chat.controller";
import {
  getMessagesZodSchema,
  sendMessageZodSchema,
} from "./chat.validation";

const router = Router();

/**
 * Route map:
 *   POST   /chat/send       → send a classroom message
 *   GET    /chat/messages   → paginated message history
 *   DELETE /chat/:id        → soft-delete a message
 */
router.post(
  "/send",
  checkAuth(Role.STUDENT, Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(sendMessageZodSchema),
  ChatController.sendMessage,
);

router.get(
  "/messages",
  checkAuth(Role.STUDENT, Role.ADMIN, Role.SUPER_ADMIN),
  validateRequest(getMessagesZodSchema, "query"),
  ChatController.getMessages,
);

router.delete(
  "/:id",
  checkAuth(Role.STUDENT, Role.ADMIN, Role.SUPER_ADMIN),
  ChatController.deleteMessage,
);

export const ChatRoutes = router;
