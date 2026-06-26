import z from "zod";

export const sendMessageZodSchema = z.object({
  classroomId: z
    .string({ message: "classroomId is required" })
    .min(1, "classroomId cannot be empty"),
  content: z
    .string({ message: "Content is required" })
    .min(1, "Message cannot be empty")
    .max(2000, "Message must be at most 2000 characters"),
});

export const getMessagesZodSchema = z.object({
  classroomId: z
    .string({ message: "classroomId is required" })
    .min(1, "classroomId cannot be empty"),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageZodSchema>;
export type GetMessagesInput = z.infer<typeof getMessagesZodSchema>;
