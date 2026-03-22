import z from "zod";

// ─── Shared ───────────────────────────────────────────────────────────────────

/**
 * Subject names are trimmed and stored as-is.
 * Duplicate detection is done case-insensitively in the service layer.
 */
const subjectNameSchema = z
  .string({ message: "Subject name is required" })
  .min(2, "Subject name must be at least 2 characters")
  .max(100, "Subject name must be at most 100 characters")
  .trim();

// ─── Create ───────────────────────────────────────────────────────────────────

export const createSubjectZodSchema = z.object({
  name: subjectNameSchema,

  classroomId: z
    .string({ message: "classroomId is required" })
    .min(1, "classroomId cannot be empty"),
});

// ─── Update ───────────────────────────────────────────────────────────────────

export const updateSubjectZodSchema = z.object({
  name: subjectNameSchema,
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type CreateSubjectInput = z.infer<typeof createSubjectZodSchema>;
export type UpdateSubjectInput = z.infer<typeof updateSubjectZodSchema>;