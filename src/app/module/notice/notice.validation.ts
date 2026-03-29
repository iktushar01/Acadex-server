import z from "zod";

export const upsertNoticeZodSchema = z.object({
  content: z
    .string({ message: "Notice content is required" })
    .trim()
    .min(1, "Notice content is required")
    .max(1000, "Notice content must be at most 1000 characters"),
});

export const toggleNoticeZodSchema = z.object({
  isActive: z.boolean({
    message: "isActive must be provided",
  }),
});
