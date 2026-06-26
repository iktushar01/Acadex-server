export type ChatbotMode = "qa" | "summarize" | "quiz" | "study_plan";

export type ExplanationLevel = "beginner" | "exam" | "advanced";

export interface IAskChatbotPayload {
  userId: string;
  classroomId: string;
  message: string;
  subjectId?: string;
  noteId?: string;
  folderId?: string;
  mode?: ChatbotMode;
  level?: ExplanationLevel;
  sessionId?: string;
  revealQuizAnswers?: boolean;
}

export interface IGetChatHistoryPayload {
  userId: string;
  classroomId: string;
  sessionId?: string;
}

export interface IReindexClassroomPayload {
  userId: string;
  classroomId: string;
}

export interface IReindexNotePayload {
  userId: string;
  noteId: string;
}

export interface ICreateSessionPayload {
  userId: string;
  classroomId: string;
  title?: string;
}

export interface IClearSessionPayload {
  userId: string;
  sessionId: string;
}

export interface ChatSource {
  noteId: string;
  noteTitle: string;
  snippet: string;
  similarity: number;
  pageNumber?: number | null;
  sourceIndex: number;
}

export interface IndexJobRecord {
  id: string;
  noteId: string;
  classroomId: string;
  status: "pending" | "processing" | "completed" | "failed";
  chunksIndexed: number;
  ocrStatus: string | null;
  error: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  noteTitle?: string;
}

export interface ClassroomIndexStats {
  totalNotes: number;
  indexedNotes: number;
  failedNotes: number;
  pendingNotes: number;
  totalChunks: number;
  lastReindexAt: string | null;
  recentJobs: IndexJobRecord[];
}
