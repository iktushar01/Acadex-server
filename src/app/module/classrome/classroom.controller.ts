import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { IRequestUser } from "../auth/auth.interface";
import { ClassroomFilterInput } from "./classroom.validation";
import { ClassroomService } from "./classroom.service";

// ─── Student ──────────────────────────────────────────────────────────────────

/**
 * POST /classrooms
 * Any authenticated student submits a classroom creation request.
 * createdBy is taken from the JWT — never from the body.
 */
const createClassroom = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;

  const result = await ClassroomService.createClassroom({
    createdBy: user.userId,
    name: req.body.name,
    institutionName: req.body.institutionName,
    level: req.body.level,
    className: req.body.className,
    department: req.body.department,
    groupName: req.body.groupName,
    description: req.body.description,
  });

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message:
      "Classroom request submitted successfully. You will be notified once an admin reviews it.",
    data: result,
  });
});

/**
 * GET /classrooms/my-memberships
 * All classrooms the current user belongs to, with their per-classroom role.
 */
const getMyClassrooms = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;
  const result = await ClassroomService.getMyClassrooms(user.userId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Classrooms fetched successfully",
    data: result,
  });
});

/**
 * GET /classrooms/my-requests
 * All classroom creation requests submitted by this user (any status).
 */
const getMyClassroomRequests = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;
  const result = await ClassroomService.getMyClassroomRequests(user.userId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Classroom requests fetched successfully",
    data: result,
  });
});

// ─── Shared ───────────────────────────────────────────────────────────────────

/**
 * GET /classrooms/:classroomId
 * Single classroom detail with member list.
 * Accessible to admins and members of that classroom.
 */
const getClassroomById = catchAsync(async (req: Request, res: Response) => {
  const result = await ClassroomService.getClassroomById(req.params.classroomId as string);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Classroom fetched successfully",
    data: result,
  });
});

// ─── Admin ────────────────────────────────────────────────────────────────────

/**
 * GET /classrooms
 * Paginated list with optional filters.
 * Admins call with ?status=PENDING to see the approval queue.
 */
const getClassrooms = catchAsync(async (req: Request, res: Response) => {
  const filters = req.query as unknown as ClassroomFilterInput;
  const result = await ClassroomService.getClassrooms(filters);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Classrooms fetched successfully",
    data: result.data,
    meta: result.meta,
  });
});

/**
 * PATCH /classrooms/:classroomId/approve
 * Approve a pending classroom.
 * Atomically sets status=APPROVED and creates CR membership for the creator.
 */
const approveClassroom = catchAsync(async (req: Request, res: Response) => {
  const admin = req.user as IRequestUser;

  const result = await ClassroomService.approveClassroom({
    classroomId: req.params.classroomId as string,
    resolvedBy: admin.userId,
  });

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message:
      "Classroom approved. The requesting student has been made CR of this classroom.",
    data: result,
  });
});

/**
 * PATCH /classrooms/:classroomId/reject
 * Reject a pending classroom with a required reason.
 */
const rejectClassroom = catchAsync(async (req: Request, res: Response) => {
  const admin = req.user as IRequestUser;

  const result = await ClassroomService.rejectClassroom({
    classroomId: req.params.classroomId as string,
    resolvedBy: admin.userId,
    rejectionReason: req.body.rejectionReason,
  });

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Classroom request rejected.",
    data: result,
  });
});

// ─── Exports ──────────────────────────────────────────────────────────────────

export const ClassroomController = {
  createClassroom,
  getMyClassrooms,
  getMyClassroomRequests,
  getClassroomById,
  getClassrooms,
  approveClassroom,
  rejectClassroom,
};