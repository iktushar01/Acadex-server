import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { AdminService } from "./admin.service";
import { StatusCodes } from "http-status-codes";
import { IRequestUser } from "../auth/auth.interface";

const getAllAdmins = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user as IRequestUser;
        const result = await AdminService.getAllAdmins(user);

        sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: "Admins fetched successfully",
            data: result,
        })
    }
)

const getDashboardStats = catchAsync(
    async (req: Request, res: Response) => {
        const user = req.user as IRequestUser;
        const result = await AdminService.getDashboardStats(user);

        sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: "Admin dashboard stats fetched successfully",
            data: result,
        })
    }
)

const getAdminById = catchAsync(
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const user = req.user as IRequestUser;

        const admin = await AdminService.getAdminById(id as string, user);

        sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: "Admin fetched successfully",
            data: admin,
        })
    }
)

const updateAdmin = catchAsync(
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const payload = req.body;
        const user = req.user as IRequestUser;

        const updatedAdmin = await AdminService.updateAdmin(id as string, payload, user);

        sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: "Admin updated successfully",
            data: updatedAdmin,
        })
    }
)

const deleteAdmin = catchAsync(
    async (req: Request, res: Response) => {
        const { id } = req.params;
        const user = req.user as IRequestUser;

        const result = await AdminService.deleteAdmin(id as string, user);

        sendResponse(res, {
            statusCode: StatusCodes.OK,
            success: true,
            message: "Admin deleted successfully",
            data: result,
        })
    }

)

export const AdminController = {
    getDashboardStats,
    getAllAdmins,
    updateAdmin,
    deleteAdmin,
    getAdminById,
};
