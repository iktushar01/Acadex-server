import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { UserService } from "./user.service";

// ─── Student ─────────────────────────────────────────────────────────────────

const createStudent = catchAsync(async (req: Request, res: Response) => {
    const result = await UserService.createStudent(req.body);

    sendResponse(res, {
        statusCode: StatusCodes.CREATED,
        success: true,
        message: "Student registered successfully",
        data: result,
    });
});

// ─── CR ──────────────────────────────────────────────────────────────────────

/**
 * POST /users/apply-cr
 * Authenticated STUDENT submits an application to become CR.
 * `req.user` is populated by checkAuth middleware.
 */
const applyCRRole = catchAsync(async (req: Request, res: Response) => {
    // studentId is resolved from the authenticated user's linked student record
    const studentId: string = (req as any).user.studentId;

    const result = await UserService.applyCRRole({
        studentId,
        semesterId: req.body.semesterId,
        reason: req.body.reason,
    });

    sendResponse(res, {
        statusCode: StatusCodes.CREATED,
        success: true,
        message: "CR application submitted successfully. Pending admin review.",
        data: result,
    });
});

/**
 * PATCH /users/cr-applications/:applicationId/approve
 * Admin approves a CR application.
 */
const approveCRApplication = catchAsync(async (req: Request, res: Response) => {
    const result = await UserService.approveCRApplication({
        applicationId: req.params.applicationId as string,
        adminNote: req.body.adminNote,
    });

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "CR application approved. Student has been promoted to CR.",
        data: result,
    });
});

/**
 * PATCH /users/cr-applications/:applicationId/reject
 * Admin rejects a CR application.
 */
const rejectCRApplication = catchAsync(async (req: Request, res: Response) => {
    const result = await UserService.rejectCRApplication(
        req.params.applicationId as string,
        req.body.adminNote,
    );

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "CR application rejected.",
        data: result,
    });
});

// ─── Admin ───────────────────────────────────────────────────────────────────

/**
 * POST /users/create-admin
 * The requesting user's role is forwarded to the service to enforce
 * role-elevation rules (only SUPER_ADMIN can create SUPER_ADMIN).
 */
const createAdmin = catchAsync(async (req: Request, res: Response) => {
    const requestingUserRole = (req as any).user.role;

    const result = await UserService.createAdmin(req.body, requestingUserRole);

    sendResponse(res, {
        statusCode: StatusCodes.CREATED,
        success: true,
        message: "Admin registered successfully",
        data: result,
    });
});

export const UserController = {
    createStudent,
    createAdmin,
    applyCRRole,
    approveCRApplication,
    rejectCRApplication,
};