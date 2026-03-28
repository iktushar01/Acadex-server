import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { IRequestUser } from "../auth/auth.interface";
import { FolderService } from "./folder.service";

/**
 * POST /folders
 * Optional file upload via coverImage field or base64 in body.
 */
const createFolder = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;
  const file = (req as any).file;

  // Convert file buffer to base64 if file was uploaded
  let coverImageBase64: string | undefined = req.body.coverImageBase64;
  if (file && !coverImageBase64) {
    coverImageBase64 = file.buffer.toString("base64");
  }

  const result = await FolderService.createFolder({
    userId: user.userId,
    name: req.body.name,
    coverImage: req.body.coverImage,
    coverImageBase64,
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
 * GET /folders/:id
 * Any classroom member (STUDENT or CR) may read folder metadata.
 */
const getFolderById = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;

  const result = await FolderService.getFolderById({
    userId: user.userId,
    folderId: req.params.id as string,
  });

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Folder fetched successfully",
    data: result,
  });
});

/**
 * PATCH /folders/:id
 * Optional file upload via coverImage field or base64 in body.
 */
const updateFolder = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;
  const file = (req as any).file;

  // Convert file buffer to base64 if file was uploaded
  let coverImageBase64: string | undefined = req.body.coverImageBase64;
  if (file && !coverImageBase64) {
    coverImageBase64 = file.buffer.toString("base64");
  }

  const result = await FolderService.updateFolder({
    userId: user.userId,
    folderId: req.params.id as string,
    name: req.body.name,
    coverImage: req.body.coverImage,
    coverImageBase64,
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
  getFolderById,
  updateFolder,
  deleteFolder,
};