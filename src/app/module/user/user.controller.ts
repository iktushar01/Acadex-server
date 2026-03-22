import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { UserService } from "./user.service";
import { StatusCodes } from "http-status-codes";

const createStudent = catchAsync(
    async (req: Request, res: Response) => {
        const payload = req.body;

        const result = await UserService.createStudent(payload);

        sendResponse(res, {
            statusCode: StatusCodes.CREATED,
            success: true,
            message: "Student registered successfully",
            data: result,
        })
    }
)

const createAdmin = catchAsync(
    async (req: Request, res: Response) => {
        const payload = req.body;

        const result = await UserService.createAdmin(payload);

        sendResponse(res, {
            statusCode: StatusCodes.CREATED,
            success: true,
            message: "Admin registered successfully",
            data: result,
        })
    }
)

export const UserController = {
    createStudent,
    createAdmin,
};