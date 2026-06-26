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
    folderId: req.body.folderId,
    mode: req.body.mode,
    level: req.body.level,
    sessionId: req.body.sessionId,
    revealQuizAnswers: req.body.revealQuizAnswers,
  });

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Answer generated successfully",
    data: result,
  });
});

const askChatbotStream = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;

  await ChatbotService.askChatbotStream(
    {
      userId: user.userId,
      classroomId: req.body.classroomId,
      message: req.body.message,
      subjectId: req.body.subjectId,
      noteId: req.body.noteId,
      folderId: req.body.folderId,
      mode: req.body.mode,
      level: req.body.level,
      sessionId: req.body.sessionId,
      revealQuizAnswers: req.body.revealQuizAnswers,
    },
    res,
  );
});

const getChatHistory = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;

  const result = await ChatbotService.getChatHistory({
    userId: user.userId,
    classroomId: req.params.classroomId as string,
    ...(req.query.sessionId
      ? { sessionId: req.query.sessionId as string }
      : {}),
  });

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Chat history fetched successfully",
    data: result,
  });
});

const listSessions = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;

  const result = await ChatbotService.listSessions(
    user.userId,
    req.params.classroomId as string,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Chat sessions fetched successfully",
    data: result,
  });
});

const createSession = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;

  const result = await ChatbotService.createSession({
    userId: user.userId,
    classroomId: req.body.classroomId,
    title: req.body.title,
  });

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: "Chat session created",
    data: result,
  });
});

const clearSession = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;

  const result = await ChatbotService.clearSession({
    userId: user.userId,
    sessionId: req.params.sessionId as string,
  });

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Chat cleared successfully",
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
    message: result.message,
    data: result,
  });
});

const reindexNote = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;

  const result = await ChatbotService.reindexNote({
    userId: user.userId,
    noteId: req.params.noteId as string,
  });

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: result.message,
    data: result,
  });
});

const getClassroomIndexStats = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;

  const result = await ChatbotService.getClassroomIndexStats(
    user.userId,
    req.params.classroomId as string,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Indexing stats fetched successfully",
    data: result,
  });
});

export const ChatbotController = {
  askChatbot,
  askChatbotStream,
  getChatHistory,
  listSessions,
  createSession,
  clearSession,
  reindexClassroom,
  reindexNote,
  getClassroomIndexStats,
};
