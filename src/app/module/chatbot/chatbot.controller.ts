import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { IRequestUser } from "../auth/auth.interface";
import { ChatbotService } from "./chatbot.service";

const askChatbot = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;

  const result = await ChatbotService.askChatbot({
    userId: user.userId,
    classroomId: req.body.classroomId,
    message: req.body.message,
    subjectId: req.body.subjectId,
    noteId: req.body.noteId,
    mode: req.body.mode,
  });

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Answer generated successfully",
    data: result,
  });
});

const getChatHistory = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;

  const result = await ChatbotService.getChatHistory({
    userId: user.userId,
    classroomId: req.params.classroomId as string,
  });

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Chat history fetched successfully",
    data: result,
  });
});

const reindexClassroom = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;

  const result = await ChatbotService.reindexClassroom({
    userId: user.userId,
    classroomId: req.params.classroomId as string,
  });

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Classroom notes indexed for study assistant",
    data: result,
  });
});

export const ChatbotController = {
  askChatbot,
  getChatHistory,
  reindexClassroom,
};
