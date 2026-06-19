import { envVars } from "../../../config/env";
import { prisma } from "../../lib/prisma";

const dimension = () => envVars.CHATBOT_EMBEDDING_DIMENSION;

export const ensureChatbotInfrastructure = async (): Promise<void> => {
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      "classroomId" TEXT NOT NULL,
      title TEXT,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE ("userId", "classroomId")
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS chat_sessions_classroom_idx
    ON chat_sessions ("classroomId")
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      "sessionId" TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      sources JSONB,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS chat_messages_session_idx
    ON chat_messages ("sessionId")
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS note_chunks (
      id TEXT PRIMARY KEY,
      "noteId" TEXT NOT NULL,
      "classroomId" TEXT NOT NULL,
      "subjectId" TEXT NOT NULL,
      "chunkIndex" INTEGER NOT NULL,
      content TEXT NOT NULL,
      "noteTitle" TEXT NOT NULL,
      embedding vector(${dimension()}),
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS note_chunks_classroom_idx
    ON note_chunks ("classroomId")
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS note_chunks_note_idx
    ON note_chunks ("noteId")
  `);
};
