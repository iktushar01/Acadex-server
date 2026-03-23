import { Router } from "express";
import { Role } from "../../../generated/prisma";
import { checkAuth } from "../../middleware/checkAuth";
import { FavoriteController } from "./favorite.controller";

const router = Router();

/**
 * Authorization model:
 *
 *   Global checkAuth → confirms valid JWT (user is logged in)
 *   Classroom membership + note visibility → checked inside the SERVICE.
 *
 * No body validation needed — all inputs are either JWT (userId) or
 * route params (noteId). No request body is accepted for any favorite action.
 *
 * All authenticated users (STUDENT, ADMIN, SUPER_ADMIN) can use favorites.
 */

/**
 * GET /favorites
 * Returns all notes the current user has favorited.
 *
 * ⚠️  Must be defined BEFORE /:noteId routes to prevent "check" or any
 *     future literal path being parsed as a noteId param.
 */
router.get(
  "/",
  checkAuth(Role.STUDENT, Role.ADMIN, Role.SUPER_ADMIN),
  FavoriteController.getMyFavorites,
);

/**
 * GET /favorites/check/:noteId
 * Returns { isFavorited: boolean } for a specific note.
 * Use on note detail pages to initialise the heart icon state.
 *
 * ⚠️  Must be before POST /:noteId (same literal-before-param rule).
 */
router.get(
  "/check/:noteId",
  checkAuth(Role.STUDENT, Role.ADMIN, Role.SUPER_ADMIN),
  FavoriteController.checkFavorite,
);

/**
 * POST /favorites/:noteId
 * Toggle: adds the favorite if absent, removes it if present.
 * Returns { isFavorited: boolean, noteId: string }.
 */
router.post(
  "/:noteId",
  checkAuth(Role.STUDENT, Role.ADMIN, Role.SUPER_ADMIN),
  FavoriteController.toggleFavorite,
);

export const FavoriteRoutes = router;