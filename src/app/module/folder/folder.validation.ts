import z from "zod";

// ─── Shared ───────────────────────────────────────────────────────────────────

const folderNameSchema = z
  .string({ message: "Folder name is required" })
  .min(2, "Folder name must be at least 2 characters")
  .max(100, "Folder name must be at most 100 characters")
  .trim();

/**
 * coverImage accepts any valid URL (imgbb, or any CDN).
 * Stored as-is — the backend does not upload or validate the image content.
 */
const coverImageSchema = z
  .string()
  .url("coverImage must be a valid URL")
  .optional();

const coverImageBase64Schema = z.string().optional();

// ─── Create ───────────────────────────────────────────────────────────────────

export const createFolderZodSchema = z.object({
  name: folderNameSchema,

  coverImage: coverImageSchema,
  coverImageBase64: coverImageBase64Schema,

  subjectId: z
    .string({ message: "subjectId is required" })
    .min(1, "subjectId cannot be empty"),
});

// ─── Update ───────────────────────────────────────────────────────────────────

/**
 * Both fields are optional — caller can update name, coverImage, or both.
 * At least one must be present (enforced by .refine).
 *
 * Pass coverImage: null to explicitly remove an existing cover image.
 */
export const updateFolderZodSchema = z
  .object({
    name: folderNameSchema.optional(),

    // null = remove the image; string = replace; undefined = leave unchanged
    coverImage: z
      .string()
      .url("coverImage must be a valid URL")
      .nullable()
      .optional(),
    
    coverImageBase64: coverImageBase64Schema,
  })
  .refine((data) => data.name !== undefined || data.coverImage !== undefined || data.coverImageBase64 !== undefined, {
    message: "At least one of name, coverImage, or coverImageBase64 must be provided",
  });

// ─── Inferred types ───────────────────────────────────────────────────────────

export type CreateFolderInput = z.infer<typeof createFolderZodSchema>;
export type UpdateFolderInput = z.infer<typeof updateFolderZodSchema>;