import z from "zod";

// ─── Create Comment / Reply ───────────────────────────────────────────────────

/**
 * Used for both top-level comments and replies.
 * If parentId is present → it's a reply.
 * If parentId is absent  → it's a top-level comment.
 *
 * noteId is always required — the frontend must always know which note
 * the thread belongs to, even when posting a reply.
 */
export const createCommentZodSchema = z.object({
  noteId: z
    .string({ message: "noteId is required" })
    .min(1, "noteId cannot be empty"),

  content: z
    .string({ message: "Content is required" })
    .min(1, "Comment cannot be empty")
    .max(1000, "Comment must be at most 1000 characters"),

  parentId: z
    .string()
    .min(1, "parentId cannot be empty")
    .optional(),
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type CreateCommentInput = z.infer<typeof createCommentZodSchema>;