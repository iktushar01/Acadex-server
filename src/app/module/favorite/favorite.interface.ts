// ─── Toggle ───────────────────────────────────────────────────────────────────

export interface IToggleFavoritePayload {
  /** Resolved from JWT — never from request body */
  userId: string;
  /** Route param */
  noteId: string;
}

// ─── Get ──────────────────────────────────────────────────────────────────────

export interface IGetMyFavoritesPayload {
  /** Resolved from JWT */
  userId: string;
}

// ─── Toggle result ────────────────────────────────────────────────────────────

/**
 * Returned by toggleFavorite so the frontend knows the new state
 * without having to refetch. isFavorited = true means it was just added.
 */
export interface IToggleFavoriteResult {
  isFavorited: boolean;
  noteId: string;
}