import z from "zod";

const chatbotModeSchema = z.enum(["qa", "summarize", "quiz", "study_plan"]);
const explanationLevelSchema = z.enum(["beginner", "exam", "advanced"]);

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
  folderId: z.string().min(1).optional(),
  sessionId: z.string().min(1).optional(),

  mode: chatbotModeSchema.optional(),
  level: explanationLevelSchema.optional(),
  revealQuizAnswers: z.boolean().optional(),
});

export const classroomIdParamSchema = z.object({
  classroomId: z.string().min(1, "classroomId is required"),
});

export const sessionIdParamSchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
});

export const noteIdParamSchema = z.object({
  noteId: z.string().min(1, "noteId is required"),
});

export const createSessionZodSchema = z.object({
  classroomId: z.string().min(1),
  title: z.string().max(80).optional(),
});

export const historyQuerySchema = z.object({
  sessionId: z.string().min(1).optional(),
});

export type AskChatbotInput = z.infer<typeof askChatbotZodSchema>;
