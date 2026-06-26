import { Response } from "express";
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
  ClassroomIndexStats,
  ExplanationLevel,
  IAskChatbotPayload,
  IClearSessionPayload,
  ICreateSessionPayload,
  IGetChatHistoryPayload,
  IReindexClassroomPayload,
  IReindexNotePayload,
} from "./chatbot.interface";
import { OpenRouterClient } from "./openrouter.client";
import {
  countChunksForClassroom,
  getLastReindexTime,
  getRecentIndexJobs,
  searchSimilarChunks,
} from "./chatbot.store";
import { ensureChatbotInfrastructure } from "./chatbot.bootstrap";
import { ChatbotIngestion } from "./chatbot.ingestion";
import { buildContextBlock, buildSystemPrompt } from "./chatbot.prompts";
import { rewriteQueryForRetrieval } from "./chatbot.query-rewrite";
import { checkChatbotRateLimit } from "./chatbot.rate-limit";

const getModelForMode = (mode: ChatbotMode): string => {
  switch (mode) {
    case "quiz":
    case "study_plan":
      return envVars.OPENROUTER_LLM_MODEL_POWER;
    default:
      return envVars.OPENROUTER_LLM_MODEL_FAST;
  }
};

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

const resolveSession = async (
  userId: string,
  classroomId: string,
  sessionId?: string,
) => {
  if (sessionId) {
    const existing = await prisma.chatSession.findFirst({
      where: { id: sessionId, userId, classroomId, archivedAt: null },
    });

    if (!existing) {
      throw new AppError(StatusCodes.NOT_FOUND, "Chat session not found");
    }

    await prisma.chatSession.update({
      where: { id: existing.id },
      data: { updatedAt: new Date() },
    });

    return existing;
  }

  const latest = await prisma.chatSession.findFirst({
    where: { userId, classroomId, archivedAt: null },
    orderBy: { updatedAt: "desc" },
  });

  if (latest) return latest;

  return prisma.chatSession.create({
    data: { userId, classroomId },
  });
};

const buildRetrievalContext = async (payload: {
  message: string;
  mode: ChatbotMode;
  classroomId: string;
  subjectId?: string;
  noteId?: string;
  folderId?: string;
}) => {
  const rewrittenQuery = await rewriteQueryForRetrieval(
    payload.message,
    payload.mode,
  );

  const queryEmbedding = await OpenRouterClient.embedText(rewrittenQuery);

  const chunks = await searchSimilarChunks({
    classroomId: payload.classroomId,
    ...(payload.subjectId ? { subjectId: payload.subjectId } : {}),
    ...(payload.noteId ? { noteId: payload.noteId } : {}),
    ...(payload.folderId ? { folderId: payload.folderId } : {}),
    embedding: queryEmbedding,
    keywordQuery: rewrittenQuery,
    topK: envVars.CHATBOT_TOP_K,
    minSimilarity: envVars.CHATBOT_MIN_SIMILARITY,
  });

  const sources: ChatSource[] = chunks.map((chunk, index) => ({
    noteId: chunk.noteId,
    noteTitle: chunk.noteTitle,
    snippet: chunk.content.slice(0, 240),
    similarity: Number(chunk.combinedScore ?? chunk.similarity),
    pageNumber: chunk.pageNumber,
    sourceIndex: index + 1,
  }));

  return {
    rewrittenQuery,
    chunks,
    sources,
    contextBlock: buildContextBlock(chunks),
  };
};

const buildChatMessages = (payload: {
  mode: ChatbotMode;
  level?: ExplanationLevel;
  revealQuizAnswers?: boolean;
  contextBlock: string;
  message: string;
  hasChunks: boolean;
  history: Array<{ role: string; content: string }>;
}) => {
  const userPrompt = payload.hasChunks
    ? `Context from classroom notes:\n\n${payload.contextBlock}\n\nStudent question:\n${payload.message}`
    : `No matching classroom notes were found for this question.\n\nStudent question:\n${payload.message}`;

  const history = payload.history.flatMap((entry) => [
    {
      role: entry.role as "user" | "assistant",
      content: entry.content,
    },
  ]);

  return [
    {
      role: "system" as const,
      content: buildSystemPrompt(
        payload.mode,
        payload.level,
        payload.revealQuizAnswers,
      ),
    },
    ...history,
    { role: "user" as const, content: userPrompt },
  ];
};

const askChatbot = async (payload: IAskChatbotPayload) => {
  await ensureChatbotInfrastructure();
  checkChatbotRateLimit(payload.userId);

  const {
    userId,
    classroomId,
    message,
    subjectId,
    noteId,
    folderId,
    mode = "qa",
    level,
    sessionId,
    revealQuizAnswers = false,
  } = payload;

  await assertClassroomMember(userId, classroomId);

  if (noteId) {
    await assertNoteInClassroom(noteId, classroomId);
  }

  const session = await resolveSession(userId, classroomId, sessionId);

  const recentMessages = await prisma.chatMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: "desc" },
    take: envVars.CHATBOT_HISTORY_LIMIT,
    select: { role: true, content: true },
  });

  const { chunks, sources, contextBlock } = await buildRetrievalContext({
    message,
    mode,
    classroomId,
    ...(subjectId ? { subjectId } : {}),
    ...(noteId ? { noteId } : {}),
    ...(folderId ? { folderId } : {}),
  });

  const messages = buildChatMessages({
    mode,
    ...(level ? { level } : {}),
    revealQuizAnswers,
    contextBlock,
    message,
    hasChunks: chunks.length > 0,
    history: [...recentMessages].reverse(),
  });

  const answer = await OpenRouterClient.chatCompletion(messages, {
    model: getModelForMode(mode),
    maxTokens: mode === "study_plan" ? 1800 : 1200,
  });

  await prisma.$transaction([
    prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: "user",
        content: message,
        mode,
      },
    }),
    prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: "assistant",
        content: answer,
        mode,
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

const askChatbotStream = async (
  payload: IAskChatbotPayload,
  res: Response,
) => {
  await ensureChatbotInfrastructure();
  checkChatbotRateLimit(payload.userId);

  const {
    userId,
    classroomId,
    message,
    subjectId,
    noteId,
    folderId,
    mode = "qa",
    level,
    sessionId,
    revealQuizAnswers = false,
  } = payload;

  await assertClassroomMember(userId, classroomId);

  if (noteId) {
    await assertNoteInClassroom(noteId, classroomId);
  }

  const session = await resolveSession(userId, classroomId, sessionId);

  const recentMessages = await prisma.chatMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: "desc" },
    take: envVars.CHATBOT_HISTORY_LIMIT,
    select: { role: true, content: true },
  });

  const { chunks, sources, contextBlock } = await buildRetrievalContext({
    message,
    mode,
    classroomId,
    ...(subjectId ? { subjectId } : {}),
    ...(noteId ? { noteId } : {}),
    ...(folderId ? { folderId } : {}),
  });

  const messages = buildChatMessages({
    mode,
    ...(level ? { level } : {}),
    revealQuizAnswers,
    contextBlock,
    message,
    hasChunks: chunks.length > 0,
    history: [...recentMessages].reverse(),
  });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  res.write(
    `data: ${JSON.stringify({ type: "meta", sessionId: session.id, sources, mode })}\n\n`,
  );

  let answer = "";

  for await (const token of OpenRouterClient.chatCompletionStream(messages, {
    model: getModelForMode(mode),
    maxTokens: mode === "study_plan" ? 1800 : 1200,
  })) {
    answer += token;
    res.write(`data: ${JSON.stringify({ type: "token", content: token })}\n\n`);
  }

  await prisma.$transaction([
    prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: "user",
        content: message,
        mode,
      },
    }),
    prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: "assistant",
        content: answer,
        mode,
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

  res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
  res.end();
};

const getChatHistory = async (payload: IGetChatHistoryPayload) => {
  await ensureChatbotInfrastructure();

  const { userId, classroomId, sessionId } = payload;

  await assertClassroomMember(userId, classroomId);

  if (sessionId) {
    const session = await prisma.chatSession.findFirst({
      where: { id: sessionId, userId, classroomId, archivedAt: null },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          take: 60,
          select: {
            id: true,
            role: true,
            content: true,
            sources: true,
            mode: true,
            createdAt: true,
          },
        },
      },
    });

    return {
      sessionId: session?.id ?? null,
      messages: session?.messages ?? [],
    };
  }

  const session = await prisma.chatSession.findFirst({
    where: { userId, classroomId, archivedAt: null },
    orderBy: { updatedAt: "desc" },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        take: 60,
        select: {
          id: true,
          role: true,
          content: true,
          sources: true,
          mode: true,
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

const listSessions = async (userId: string, classroomId: string) => {
  await ensureChatbotInfrastructure();
  await assertClassroomMember(userId, classroomId);

  const sessions = await prisma.chatSession.findMany({
    where: { userId, classroomId, archivedAt: null },
    orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
    take: 30,
    select: {
      id: true,
      title: true,
      isPinned: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  });

  return sessions.map((session) => ({
    id: session.id,
    title: session.title ?? "New conversation",
    isPinned: session.isPinned,
    messageCount: session._count.messages,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  }));
};

const createSession = async (payload: ICreateSessionPayload) => {
  await ensureChatbotInfrastructure();
  await assertClassroomMember(payload.userId, payload.classroomId);

  const session = await prisma.chatSession.create({
    data: {
      userId: payload.userId,
      classroomId: payload.classroomId,
      ...(payload.title ? { title: payload.title.slice(0, 80) } : {}),
    },
    select: {
      id: true,
      title: true,
      createdAt: true,
    },
  });

  return session;
};

const clearSession = async (payload: IClearSessionPayload) => {
  await ensureChatbotInfrastructure();

  const session = await prisma.chatSession.findFirst({
    where: {
      id: payload.sessionId,
      userId: payload.userId,
      archivedAt: null,
    },
  });

  if (!session) {
    throw new AppError(StatusCodes.NOT_FOUND, "Chat session not found");
  }

  await prisma.chatMessage.deleteMany({
    where: { sessionId: session.id },
  });

  return { sessionId: session.id };
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

  ChatbotIngestion.queueReindexClassroom(classroomId);

  return {
    queued: true,
    message: "Classroom reindex started in background",
  };
};

const reindexNote = async (payload: IReindexNotePayload) => {
  await ensureChatbotInfrastructure();

  const note = await prisma.note.findUnique({
    where: { id: payload.noteId },
    select: { classroomId: true, status: true },
  });

  if (!note) {
    throw new AppError(StatusCodes.NOT_FOUND, "Note not found");
  }

  const role = await assertClassroomMember(payload.userId, note.classroomId);

  if (role !== MembershipRole.CR) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      "Only the Class Representative can reindex notes",
    );
  }

  if (note.status !== NoteStatus.APPROVED) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "Only approved notes can be indexed",
    );
  }

  ChatbotIngestion.queueIndexNote(payload.noteId);

  return {
    queued: true,
    noteId: payload.noteId,
    message: "Note indexing started in background",
  };
};

const getClassroomIndexStats = async (
  userId: string,
  classroomId: string,
): Promise<ClassroomIndexStats> => {
  await ensureChatbotInfrastructure();

  const role = await assertClassroomMember(userId, classroomId);

  if (role !== MembershipRole.CR) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      "Only the Class Representative can view indexing stats",
    );
  }

  const [totalNotes, recentJobs, totalChunks, lastReindexAt] = await Promise.all([
    prisma.note.count({
      where: { classroomId, status: NoteStatus.APPROVED },
    }),
    getRecentIndexJobs(classroomId, 25),
    countChunksForClassroom(classroomId),
    getLastReindexTime(classroomId),
  ]);

  const latestByNote = new Map<string, (typeof recentJobs)[number]>();
  for (const job of recentJobs) {
    if (!latestByNote.has(job.noteId)) {
      latestByNote.set(job.noteId, job);
    }
  }

  const indexedNotes = [...latestByNote.values()].filter(
    (job) => job.status === "completed" && job.chunksIndexed > 0,
  ).length;

  const failedNotes = [...latestByNote.values()].filter(
    (job) => job.status === "failed",
  ).length;

  const pendingNotes = [...latestByNote.values()].filter(
    (job) => job.status === "pending" || job.status === "processing",
  ).length;

  return {
    totalNotes,
    indexedNotes,
    failedNotes,
    pendingNotes,
    totalChunks,
    lastReindexAt: lastReindexAt?.toISOString() ?? null,
    recentJobs,
  };
};

export const ChatbotService = {
  askChatbot,
  askChatbotStream,
  getChatHistory,
  listSessions,
  createSession,
  clearSession,
  reindexClassroom,
  reindexNote,
  getClassroomIndexStats,
};
