import { StatusCodes } from "http-status-codes";
import { envVars } from "../../../config/env";
import {
  ClassroomStatus,
  MembershipRole,
  NoteStatus,
} from "../../lib/prisma-exports";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import {
  ChatSource,
  ChatbotMode,
  IAskChatbotPayload,
  IGetChatHistoryPayload,
  IReindexClassroomPayload,
} from "./chatbot.interface";
import { OpenRouterClient } from "./openrouter.client";
import { searchSimilarChunks } from "./chatbot.store";
import { ensureChatbotInfrastructure } from "./chatbot.bootstrap";
import { ChatbotIngestion } from "./chatbot.ingestion";

const assertClassroomMember = async (userId: string, classroomId: string) => {
  const classroom = await prisma.classroom.findUnique({
    where: { id: classroomId },
    select: {
      id: true,
      status: true,
      memberships: {
        where: { userId },
        select: { role: true },
        take: 1,
      },
    },
  });

  if (!classroom) {
    throw new AppError(StatusCodes.NOT_FOUND, "Classroom not found");
  }

  if (classroom.status !== ClassroomStatus.APPROVED) {
    throw new AppError(StatusCodes.FORBIDDEN, "This classroom is not yet active");
  }

  if (!classroom.memberships[0]) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      "You are not a member of this classroom",
    );
  }

  return classroom.memberships[0].role;
};

const assertNoteInClassroom = async (
  noteId: string,
  classroomId: string,
): Promise<void> => {
  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: { classroomId: true, status: true },
  });

  if (!note) {
    throw new AppError(StatusCodes.NOT_FOUND, "Note not found");
  }

  if (note.classroomId !== classroomId) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "Note does not belong to this classroom",
    );
  }

  if (note.status !== NoteStatus.APPROVED) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      "Only approved notes can be used for study assistant context",
    );
  }
};

const getOrCreateSession = async (userId: string, classroomId: string) => {
  return prisma.chatSession.upsert({
    where: {
      userId_classroomId: { userId, classroomId },
    },
    create: { userId, classroomId },
    update: { updatedAt: new Date() },
  });
};

const buildSystemPrompt = (mode: ChatbotMode): string => {
  const base = `You are Acadex Study Assistant — a helpful academic tutor for classroom notes.
Answer using ONLY the provided context from approved class notes.
If the context does not contain enough information, say you do not know and suggest checking the subject folders.
Always be concise, accurate, and student-friendly.
When you use information from a note, mention the note title naturally.`;

  if (mode === "summarize") {
    return `${base}
The student wants a summary. Organize the answer with short bullet points.`;
  }

  if (mode === "quiz") {
    return `${base}
The student wants practice questions. Create 3-5 short quiz questions from the context, then provide answers at the end.`;
  }

  return base;
};

const buildContextBlock = (chunks: Array<{ noteTitle: string; content: string }>) =>
  chunks
    .map(
      (chunk, index) =>
        `[Source ${index + 1} | ${chunk.noteTitle}]\n${chunk.content}`,
    )
    .join("\n\n");

const askChatbot = async (payload: IAskChatbotPayload) => {
  await ensureChatbotInfrastructure();

  const {
    userId,
    classroomId,
    message,
    subjectId,
    noteId,
    mode = "qa",
  } = payload;

  await assertClassroomMember(userId, classroomId);

  if (noteId) {
    await assertNoteInClassroom(noteId, classroomId);
  }

  const session = await getOrCreateSession(userId, classroomId);

  const recentMessages = await prisma.chatMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: "desc" },
    take: 6,
    select: { role: true, content: true },
  });

  const queryEmbedding = await OpenRouterClient.embedText(message);

  const chunks = await searchSimilarChunks({
    classroomId,
    ...(subjectId ? { subjectId } : {}),
    ...(noteId ? { noteId } : {}),
    embedding: queryEmbedding,
    topK: envVars.CHATBOT_TOP_K,
    minSimilarity: envVars.CHATBOT_MIN_SIMILARITY,
  });

  const sources: ChatSource[] = chunks.map((chunk) => ({
    noteId: chunk.noteId,
    noteTitle: chunk.noteTitle,
    snippet: chunk.content.slice(0, 240),
    similarity: Number(chunk.similarity),
  }));

  const contextBlock = buildContextBlock(chunks);

  const userPrompt =
    chunks.length > 0
      ? `Context from classroom notes:\n\n${contextBlock}\n\nStudent question:\n${message}`
      : `No matching classroom notes were found for this question.\n\nStudent question:\n${message}`;

  const history = [...recentMessages].reverse().flatMap((entry) => [
    {
      role: entry.role as "user" | "assistant",
      content: entry.content,
    },
  ]);

  const answer = await OpenRouterClient.chatCompletion([
    { role: "system", content: buildSystemPrompt(mode) },
    ...history,
    { role: "user", content: userPrompt },
  ]);

  await prisma.$transaction([
    prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: "user",
        content: message,
      },
    }),
    prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: "assistant",
        content: answer,
        ...(sources.length > 0
          ? { sources: JSON.parse(JSON.stringify(sources)) }
          : {}),
      },
    }),
  ]);

  if (!session.title) {
    await prisma.chatSession.update({
      where: { id: session.id },
      data: { title: message.slice(0, 80) },
    });
  }

  return {
    sessionId: session.id,
    answer,
    sources,
    mode,
  };
};

const getChatHistory = async (payload: IGetChatHistoryPayload) => {
  await ensureChatbotInfrastructure();

  const { userId, classroomId } = payload;

  await assertClassroomMember(userId, classroomId);

  const session = await prisma.chatSession.findUnique({
    where: {
      userId_classroomId: { userId, classroomId },
    },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        take: 40,
        select: {
          id: true,
          role: true,
          content: true,
          sources: true,
          createdAt: true,
        },
      },
    },
  });

  return {
    sessionId: session?.id ?? null,
    messages: session?.messages ?? [],
  };
};

const reindexClassroom = async (payload: IReindexClassroomPayload) => {
  await ensureChatbotInfrastructure();

  const { userId, classroomId } = payload;

  const role = await assertClassroomMember(userId, classroomId);

  if (role !== MembershipRole.CR) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      "Only the Class Representative can reindex classroom notes",
    );
  }

  return ChatbotIngestion.reindexClassroom(classroomId);
};

export const ChatbotService = {
  askChatbot,
  getChatHistory,
  reindexClassroom,
};
