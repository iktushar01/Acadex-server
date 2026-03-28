import z from "zod";

// ─── Create Note ──────────────────────────────────────────────────────────────

/**
 * Body fields only — files are handled by multer separately.
 * folderId is optional: notes can live directly under a subject.
 */
export const createNoteZodSchema = z.object({
  title: z
    .string({ message: "Title is required" })
    .min(2, "Title must be at least 2 characters")
    .max(150, "Title must be at most 150 characters")
    .trim(),

  description: z
    .string()
    .max(1000, "Description must be at most 1000 characters")
    .trim()
    .optional(),

  classroomId: z
    .string({ message: "classroomId is required" })
    .min(1, "classroomId cannot be empty"),

  subjectId: z
    .string({ message: "subjectId is required" })
    .min(1, "subjectId cannot be empty"),

  /** Multipart often sends "" or omits the field; treat empty as absent. */
  folderId: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : val),
    z.string().min(1, "folderId cannot be empty").optional(),
  ),
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type CreateNoteInput = z.infer<typeof createNoteZodSchema>;