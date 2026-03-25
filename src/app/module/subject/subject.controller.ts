import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { IRequestUser } from "../auth/auth.interface";
import { SubjectService } from "./subject.service";

/**
 * POST /subjects
 * CR of the target classroom creates a new subject.
 * classroomId comes from the validated request body.
 * userId always comes from the JWT — never the body.
 * Optional file upload via coverImage field or base64 in body.
 */
const createSubject = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;
  const file = (req as any).file;

  // Convert file buffer to base64 if file was uploaded
  let coverImageBase64: string | undefined = req.body.coverImageBase64;
  if (file && !coverImageBase64) {
    coverImageBase64 = file.buffer.toString("base64");
  }

  const result = await SubjectService.createSubject({
    userId: user.userId,
    name: req.body.name,
    classroomId: req.body.classroomId,
    coverImage: req.body.coverImage,
    coverImageBase64,
  });

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: "Subject created successfully",
    data: result,
  });
});

/**
 * GET /subjects?classroomId=xxx
 * Any member of the classroom can fetch its subjects.
 * classroomId is a required query param — validated in the route.
 */
const getSubjectsByClassroom = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;

  const result = await SubjectService.getSubjectsByClassroom({
    userId: user.userId,
    classroomId: req.query.classroomId as string,
  });

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Subjects fetched successfully",
    data: result,
  });
});

/**
 * PATCH /subjects/:id
 * CR of the subject's classroom renames a subject.
 * classroomId is resolved inside the service from the subject record —
 * the client does not supply it.
 * Optional file upload via coverImage field or base64 in body.
 */
const updateSubject = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;
  const file = (req as any).file;

  // Convert file buffer to base64 if file was uploaded
  let coverImageBase64: string | undefined = req.body.coverImageBase64;
  if (file && !coverImageBase64) {
    coverImageBase64 = file.buffer.toString("base64");
  }

  const result = await SubjectService.updateSubject({
    userId: user.userId,
    subjectId: req.params.id as string,
    name: req.body.name,
    coverImage: req.body.coverImage,
    coverImageBase64,
  });

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Subject updated successfully",
    data: result,
  });
});

/**
 * DELETE /subjects/:id
 * CR of the subject's classroom deletes a subject and all its notes.
 */
const deleteSubject = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;

  const result = await SubjectService.deleteSubject({
    userId: user.userId,
    subjectId: req.params.id as string,
  });

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: `Subject "${result.name}" deleted along with ${result.deletedNotesCount} note(s)`,
    data: result,
  });
});

// ─── Exports ──────────────────────────────────────────────────────────────────

export const SubjectController = {
  createSubject,
  getSubjectsByClassroom,
  updateSubject,
  deleteSubject,
};