import z from "zod";

export const askChatbotZodSchema = z.object({
  classroomId: z
    .string({ message: "classroomId is required" })
    .min(1, "classroomId cannot be empty"),

  message: z
    .string({ message: "message is required" })
    .min(1, "Message cannot be empty")
    .max(2000, "Message must be at most 2000 characters")
    .trim(),

  subjectId: z.string().min(1).optional(),
  noteId: z.string().min(1).optional(),

  mode: z.enum(["qa", "summarize", "quiz"]).optional(),
});

export const classroomIdParamSchema = z.object({
  classroomId: z.string().min(1, "classroomId is required"),
});

export type AskChatbotInput = z.infer<typeof askChatbotZodSchema>;
