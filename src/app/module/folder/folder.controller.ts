import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { IRequestUser } from "../auth/auth.interface";
import { FolderService } from "./folder.service";

/**
 * POST /folders
 */
const createFolder = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;

  const result = await FolderService.createFolder({
    userId: user.userId,
    name: req.body.name,
    coverImage: req.body.coverImage,
    coverImageBase64: req.body.coverImageBase64,
    subjectId: req.body.subjectId,
  });

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: "Folder created successfully",
    data: result,
  });
});

/**
 * GET /folders?subjectId=xxx
 */
const getFoldersBySubject = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;

  const result = await FolderService.getFoldersBySubject({
    userId: user.userId,
    subjectId: req.query.subjectId as string,
  });

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Folders fetched successfully",
    data: result,
  });
});

/**
 * PATCH /folders/:id
 */
const updateFolder = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;

  const result = await FolderService.updateFolder({
    userId: user.userId,
    folderId: req.params.id as string,
    name: req.body.name,
    coverImage: req.body.coverImage,
    coverImageBase64: req.body.coverImageBase64,
  });

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Folder updated successfully",
    data: result,
  });
});

/**
 * DELETE /folders/:id
 */
const deleteFolder = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;

  const result = await FolderService.deleteFolder({
    userId: user.userId,
    folderId: req.params.id as string,
  });

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: `Folder "${result.name}" deleted along with ${result.deletedNotesCount} note(s)`,
    data: result,
  });
});

export const FolderController = {
  createFolder,
  getFoldersBySubject,
  updateFolder,
  deleteFolder,
};