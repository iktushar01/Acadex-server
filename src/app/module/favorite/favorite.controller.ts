import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { IRequestUser } from "../auth/auth.interface";
import { FavoriteService } from "./favorite.service";

/**
 * POST /favorites/:noteId
 * Toggles a favorite on a note.
 *
 * If the note is already favorited by this user → removes it (unfavorite).
 * If not → creates the favorite.
 *
 * Response includes `isFavorited` (new state) so the frontend can update
 * the heart icon without a refetch.
 *
 * noteId comes from the route param.
 * userId always comes from the JWT — never from the body.
 */
const toggleFavorite = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;

  const result = await FavoriteService.toggleFavorite({
    userId: user.userId,
    noteId: req.params.noteId as string,
  });

  const message = result.isFavorited
    ? "Note added to favorites"
    : "Note removed from favorites";

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message,
    data: result,
  });
});

/**
 * GET /favorites
 * Returns all notes the current user has favorited, newest first.
 * Each item includes the full note shape (files, uploader, subject, folder).
 */
const getMyFavorites = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;

  const result = await FavoriteService.getMyFavorites({
    userId: user.userId,
  });

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Favorites fetched successfully",
    data: result,
  });
});

/**
 * GET /favorites/check/:noteId
 * Returns whether the current user has favorited a specific note.
 * Useful for initialising the heart icon on note detail / list pages.
 */
const checkFavorite = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as IRequestUser;

  const favorited = await FavoriteService.isFavorited(
    user.userId,
    req.params.noteId as string,
  );

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Favorite status fetched",
    data: { noteId: req.params.noteId, isFavorited: favorited },
  });
});

// ─── Exports ──────────────────────────────────────────────────────────────────

export const FavoriteController = {
  toggleFavorite,
  getMyFavorites,
  checkFavorite,
};