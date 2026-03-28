import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { IRequestUser } from "../auth/auth.interface";
import { NoteService } from "./notes.service";
import { uploadFileToCloudinary } from "../../../config/cloudinary.config";

/**
 * POST /notes
 * Any classroom member uploads a note with one or more files.
 *
 * multer runs BEFORE this handler via route middleware, parsing the files
 * into memory as buffers.
 *
 * userId is always taken from the JWT — never from req.body.
 */
const createNote = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;
  const files = req.files as Express.Multer.File[] | undefined;

  if (!files?.length) {
    return res.status(400).json({
      success: false,
      message: "At least one file is required under the field name 'files'",
    });
  }

  // 1. Upload each memory buffer to Cloudinary manually
  const uploadedFiles = await Promise.all(
    files.map(async (f) => {
      const uploadResult = await uploadFileToCloudinary(f.buffer, f.originalname);
      return {
        path: uploadResult.secure_url,
        originalname: f.originalname,
        mimetype: f.mimetype,
        size: f.size,
      };
    })
  );

  // 2. Call service with Cloudinary URLs
  const result = await NoteService.createNote({
    uploadedBy: user.userId,
    title: req.body.title,
    description: req.body.description,
    classroomId: req.body.classroomId,
    subjectId: req.body.subjectId,
    folderId: req.body.folderId,
    files: uploadedFiles,
  });

  sendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: "Note uploaded successfully. Pending CR approval.",
    data: result,
  });
});

/**
 * GET /notes?subjectId=xxx&folderId=yyy
 * STUDENT → only APPROVED notes
 * CR      → all notes (PENDING, APPROVED, REJECTED)
 *
 * subjectId is required; folderId is optional.
 * classroomId is resolved server-side from the subject record.
 */
const getNotes = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;

  const result = await NoteService.getNotes({
    userId: user.userId,
    query: req.query,
  });

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Notes fetched successfully",
    data: result,
  });
});

/**
 * GET /notes/:id
 * Returns a single note if the caller is allowed to view it.
 */
const getNoteById = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;

  const result = await NoteService.getNoteById({
    userId: user.userId,
    noteId: req.params.id as string,
  });

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Note fetched successfully",
    data: result,
  });
});

/**
 * PATCH /notes/:id/approve
 * CR of the note's classroom approves a PENDING note.
 */
const approveNote = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;

  const result = await NoteService.approveNote({
    userId: user.userId,
    noteId: req.params.id as string,
  });

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Note approved successfully",
    data: result,
  });
});

/**
 * PATCH /notes/:id/reject
 * CR of the note's classroom rejects a PENDING note.
 */
const rejectNote = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;

  const result = await NoteService.rejectNote({
    userId: user.userId,
    noteId: req.params.id as string,
  });

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Note rejected",
    data: result,
  });
});

/**
 * DELETE /notes/:id
 * The uploader OR the CR of the classroom can delete a note.
 * Cascades: deletes NoteFiles and cleans up Cloudinary.
 */
const deleteNote = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;

  const result = await NoteService.deleteNote({
    userId: user.userId,
    noteId: req.params.id as string,
  });

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: `Note "${result.title}" deleted along with ${result.deletedFilesCount} file(s)`,
    data: result,
  });
});

// ─── Exports ──────────────────────────────────────────────────────────────────

export const NoteController = {
  createNote,
  getNotes,
  getNoteById,
  approveNote,
  rejectNote,
  deleteNote,
};
