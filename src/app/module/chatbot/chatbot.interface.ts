export type ChatbotMode = "qa" | "summarize" | "quiz";

export interface IAskChatbotPayload {
  userId: string;
  classroomId: string;
  message: string;
  subjectId?: string;
  noteId?: string;
  mode?: ChatbotMode;
}

export interface IGetChatHistoryPayload {
  userId: string;
  classroomId: string;
}

export interface IReindexClassroomPayload {
  userId: string;
  classroomId: string;
}

export interface ChatSource {
  noteId: string;
  noteTitle: string;
  snippet: string;
  similarity: number;
}
