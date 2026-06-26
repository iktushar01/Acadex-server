import { ClassroomStatus, MembershipRole } from "../../lib/prisma-exports";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { StatusCodes } from "http-status-codes";
import {
  IDeleteMessagePayload,
  IDeleteMessageResult,
  IGetMessagesPayload,
  IGetMessagesResult,
  IGroupMessageView,
  ISendMessagePayload,
} from "./chat.interface";
import { classroomChannel, isPusherConfigured, pusher } from "./pusher.client";

const DEFAULT_LIMIT = 50;

const messageSenderSelect = {
  id: true,
  name: true,
  image: true,
} as const;

const messageSelect = {
  id: true,
  classroomId: true,
  content: true,
  createdAt: true,
  sender: { select: messageSenderSelect },
} as const;

const assertClassroomMember = async (userId: string, classroomId: string) => {
  const membership = await prisma.membership.findUnique({
    where: {
      userId_classroomId: { userId, classroomId },
    },
    select: {
      role: true,
      classroom: { select: { status: true } },
    },
  });

  if (!membership) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      "You are not a member of this classroom",
    );
  }

  if (membership.classroom.status !== ClassroomStatus.APPROVED) {
    throw new AppError(StatusCodes.FORBIDDEN, "This classroom is not active");
  }

  return membership;
};

const triggerPusherEvent = async (
  classroomId: string,
  event: string,
  payload: unknown,
) => {
  if (!isPusherConfigured || !pusher) return;

  await pusher.trigger(classroomChannel(classroomId), event, payload);
};

const sendMessage = async (
  payload: ISendMessagePayload,
): Promise<IGroupMessageView> => {
  const { userId, classroomId, content } = payload;

  if (!content.trim()) {
    throw new AppError(StatusCodes.BAD_REQUEST, "Message cannot be empty");
  }

  await assertClassroomMember(userId, classroomId);

  const message = await prisma.groupMessage.create({
    data: {
      classroomId,
      senderId: userId,
      content: content.trim(),
    },
    select: messageSelect,
  });

  await triggerPusherEvent(classroomId, "new-message", message);

  return message;
};

const getMessages = async (
  payload: IGetMessagesPayload,
): Promise<IGetMessagesResult> => {
  const { userId, classroomId, cursor, limit = DEFAULT_LIMIT } = payload;

  await assertClassroomMember(userId, classroomId);

  const rows = await prisma.groupMessage.findMany({
    where: {
      classroomId,
      deletedAt: null,
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    select: messageSelect,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const messages = [...page].reverse();
  const nextCursor =
    hasMore && messages.length > 0
      ? messages[0]!.createdAt.toISOString()
      : null;

  return { messages, hasMore, nextCursor };
};

const deleteMessage = async (
  payload: IDeleteMessagePayload,
): Promise<IDeleteMessageResult> => {
  const { userId, messageId } = payload;

  const message = await prisma.groupMessage.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      classroomId: true,
      senderId: true,
      deletedAt: true,
    },
  });

  if (!message || message.deletedAt) {
    throw new AppError(StatusCodes.NOT_FOUND, "Message not found");
  }

  const membership = await assertClassroomMember(userId, message.classroomId);

  const isOwner = message.senderId === userId;
  const isCR = membership.role === MembershipRole.CR;

  if (!isOwner && !isCR) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      "You do not have permission to delete this message",
    );
  }

  await prisma.groupMessage.update({
    where: { id: messageId },
    data: { deletedAt: new Date() },
  });

  await triggerPusherEvent(message.classroomId, "delete-message", {
    id: message.id,
    classroomId: message.classroomId,
  });

  return { id: message.id, classroomId: message.classroomId };
};

export const ChatService = {
  sendMessage,
  getMessages,
  deleteMessage,
};
