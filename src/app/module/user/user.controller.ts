import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { IRequestUser } from "../auth/auth.interface";
import { UserService } from "./user.service";

// ─── Admin ────────────────────────────────────────────────────────────────────

/**
 * POST /users/create-admin
 * The requesting user's role is forwarded to the service so it can enforce
 * the SUPER_ADMIN-only elevation rule server-side (defence in depth).
 */
const createAdmin = catchAsync(async (req: Request, res: Response) => {
    const requestingUser = req.user as IRequestUser;

    const result = await UserService.createAdmin(req.body, requestingUser.role);

    sendResponse(res, {
        statusCode: StatusCodes.CREATED,
        success: true,
        message: "Admin registered successfully",
        data: result,
    });
});

// ─── CR Application ───────────────────────────────────────────────────────────

/**
 * POST /users/apply-cr
 * The studentId is resolved from the authenticated session — never from the body.
 */
const applyCRRole = catchAsync(async (req: Request, res: Response) => {
    const requestingUser = req.user as IRequestUser;

    // The student record is looked up by userId inside the service
    // so we resolve studentId here via a quick DB lookup, or you can
    // store studentId directly on the JWT payload for efficiency.
    // Here we assume req.user has been extended with studentId by checkAuth.
    const studentId: string = (requestingUser as any).studentId;

    const result = await UserService.applyCRRole({
        studentId,
        semesterId: req.body.semesterId,
        reason: req.body.reason,
    });

    sendResponse(res, {
        statusCode: StatusCodes.CREATED,
        success: true,
        message: "CR application submitted. Pending admin review.",
        data: result,
    });
});

/**
 * PATCH /users/cr-applications/:applicationId/approve
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

// ─── Exports ──────────────────────────────────────────────────────────────────

export const UserController = {
    createAdmin,
    applyCRRole,
    approveCRApplication,
    rejectCRApplication,
};