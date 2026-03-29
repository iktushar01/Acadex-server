import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { IRequestUser } from "../auth/auth.interface";
import { NoticeService } from "./notice.service";

const getCurrentNotice = catchAsync(async (_req: Request, res: Response) => {
  const result = await NoticeService.getCurrentNotice();

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Notice fetched successfully",
    data: result,
  });
});

const upsertNotice = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;
  const result = await NoticeService.upsertNotice({
    content: req.body.content,
    updatedBy: user.userId,
  });

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Notice saved successfully",
    data: result,
  });
});

const toggleNotice = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;
  const result = await NoticeService.toggleNotice({
    isActive: req.body.isActive,
    updatedBy: user.userId,
  });

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: `Notice ${result.isActive ? "activated" : "deactivated"} successfully`,
    data: result,
  });
});

export const NoticeController = {
  getCurrentNotice,
  upsertNotice,
  toggleNotice,
};
