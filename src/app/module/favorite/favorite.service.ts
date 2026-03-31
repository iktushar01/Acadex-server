import { ClassroomStatus, MembershipRole, NoteStatus } from "../../lib/prisma-exports";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { StatusCodes } from "http-status-codes";
import {
  IGetMyFavoritesPayload,
  IToggleFavoritePayload,
  IToggleFavoriteResult,
} from "./favorite.interface";

// ─── Shared select ────────────────────────────────────────────────────────────

/**
 * Full note shape returned inside "my favorites" list.
 * Mirrors the noteSelect in note.service so both endpoints return
 * a consistent note shape the frontend can rely on.
 */
const favoriteNoteSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  classroomId: true,
  subjectId: true,
  folderId: true,
  createdAt: true,
  updatedAt: true,
  uploader: {
    select: { id: true, name: true, email: true },
  },
  subject: {
    select: { id: true, name: true },
  },
  folder: {
    select: { id: true, name: true },
  },
  files: {
    select: {
      id: true,
      url: true,
      type: true,
      fileName: true,
      fileSize: true,
    },
    orderBy: { createdAt: "asc" as const },
  },
  _count: {
    select: { favorites: true },
  },
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolves the note and validates that the caller is a member of its classroom.
 *
 * Checks (in order):
 *   1. Note exists
 *   2. Note is APPROVED (students should not be able to favorite pending/rejected notes)
 *   3. Classroom is APPROVED (active)
 *   4. User has a Membership row for that classroom
 *
 * Returns the note so callers have classroomId + noteId without a second query.
 */
const assertCanFavorite = async (userId: string, noteId: string) => {
  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: {
      id: true,
      status: true,
      classroomId: true,
      classroom: {
        select: {
          status: true,
          memberships: {
            where: { userId },
            select: { role: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!note) {
    throw new AppError(StatusCodes.NOT_FOUND, "Note not found");
  }

  // Only APPROVED notes are visible to students — they should not be able
  // to favorite notes they cannot see
  if (note.status !== NoteStatus.APPROVED) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      "You can only favorite approved notes",
    );
  }

  if (note.classroom.status !== ClassroomStatus.APPROVED) {
    throw new AppError(StatusCodes.FORBIDDEN, "This classroom is not yet active");
  }

  const membership = note.classroom.memberships[0];

  if (!membership) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      "You are not a member of this classroom",
    );
  }

  return note;
};

// ─── Toggle Favorite ──────────────────────────────────────────────────────────

/**
 * Adds or removes a favorite in a single call (toggle pattern).
 *
 * If the user has already favorited the note → remove it (unfavorite).
 * If not → create the favorite.
 *
 * The response includes `isFavorited` (new state) so the frontend can
 * update the heart icon without a refetch.
 *
 * Guards:
 *   - Note must exist and be APPROVED
 *   - Caller must be a member of the note's classroom
 */
const toggleFavorite = async (
  payload: IToggleFavoritePayload,
): Promise<IToggleFavoriteResult> => {
  const { userId, noteId } = payload;

  // Validate access in one query
  await assertCanFavorite(userId, noteId);

  // Check if already favorited
  const existing = await prisma.favorite.findUnique({
    where: {
      userId_noteId: { userId, noteId },
    },
    select: { id: true },
  });

  if (existing) {
    // Already favorited → remove it
    await prisma.favorite.delete({
      where: { userId_noteId: { userId, noteId } },
    });

    return { isFavorited: false, noteId };
  }

  // Not yet favorited → create it
  await prisma.favorite.create({
    data: { userId, noteId },
  });

  return { isFavorited: true, noteId };
};

// ─── Get My Favorites ─────────────────────────────────────────────────────────

/**
 * Returns all notes the current user has favorited, newest first.
 *
 * Filters out favorites whose note has been deleted (Cascade handles the
 * Favorite row, but this query never returns them anyway since we join on note).
 *
 * No classroom membership check needed here — the user already proved
 * membership when they favorited the note. If they were later removed
 * from the classroom, their favorites remain visible to them (bookmarks
 * are personal). Adjust this if your product requires stricter scoping.
 */
const getMyFavorites = async (payload: IGetMyFavoritesPayload) => {
  const { userId } = payload;

  const favorites = await prisma.favorite.findMany({
    where: { userId },
    select: {
      id: true,
      createdAt: true,
      note: {
        select: favoriteNoteSelect,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Return a flat list — the frontend rarely needs the wrapper Favorite object
  return favorites.map((f) => ({
    favoriteId: f.id,
    savedAt: f.createdAt,
    note: f.note,
  }));
};

// ─── Check if Favorited ───────────────────────────────────────────────────────

/**
 * Returns whether the current user has favorited a specific note.
 * Useful for initialising the heart icon state on note detail pages.
 */
const isFavorited = async (userId: string, noteId: string): Promise<boolean> => {
  const favorite = await prisma.favorite.findUnique({
    where: { userId_noteId: { userId, noteId } },
    select: { id: true },
  });

  return favorite !== null;
};

// ─── Exports ──────────────────────────────────────────────────────────────────

export const FavoriteService = {
  toggleFavorite,
  getMyFavorites,
  isFavorited,
};
