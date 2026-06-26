import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { IRequestUser } from "../auth/auth.interface";
import { ChatService } from "./chat.service";

const sendMessage = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;

  const result = await ChatService.sendMessage({
    userId: user.userId,
    classroomId: req.body.classroomId,
    content: req.body.content,
  });

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: "Message sent successfully",
    data: result,
  });
});

const getMessages = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;

  const result = await ChatService.getMessages({
    userId: user.userId,
    classroomId: req.query.classroomId as string,
    ...(req.query.cursor
      ? { cursor: req.query.cursor as string }
      : {}),
    ...(req.query.limit
      ? { limit: Number(req.query.limit) }
      : {}),
  });

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Messages fetched successfully",
    data: result.messages,
    meta: {
      hasMore: result.hasMore,
      nextCursor: result.nextCursor,
    },
  });
});

const deleteMessage = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;

  const result = await ChatService.deleteMessage({
    userId: user.userId,
    messageId: req.params.id as string,
  });

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Message deleted successfully",
    data: result,
  });
});

export const ChatController = {
  sendMessage,
  getMessages,
  deleteMessage,
};
