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
      "isPinned" BOOLEAN NOT NULL DEFAULT false,
      "archivedAt" TIMESTAMP,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE chat_sessions DROP CONSTRAINT IF EXISTS chat_sessions_userId_classroomId_key
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS "isPinned" BOOLEAN NOT NULL DEFAULT false
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS chat_sessions_classroom_idx
    ON chat_sessions ("classroomId")
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS chat_sessions_user_classroom_idx
    ON chat_sessions ("userId", "classroomId")
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      "sessionId" TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      sources JSONB,
      mode TEXT,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS mode TEXT
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
      "folderId" TEXT,
      "chunkIndex" INTEGER NOT NULL,
      content TEXT NOT NULL,
      "noteTitle" TEXT NOT NULL,
      "pageNumber" INTEGER,
      embedding vector(${dimension()}),
      search_vector tsvector,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE note_chunks ADD COLUMN IF NOT EXISTS "folderId" TEXT
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE note_chunks ADD COLUMN IF NOT EXISTS "pageNumber" INTEGER
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE note_chunks ADD COLUMN IF NOT EXISTS search_vector tsvector
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS note_chunks_classroom_idx
    ON note_chunks ("classroomId")
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS note_chunks_note_idx
    ON note_chunks ("noteId")
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS note_chunks_subject_idx
    ON note_chunks ("subjectId")
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS note_chunks_folder_idx
    ON note_chunks ("folderId")
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS note_chunks_search_idx
    ON note_chunks USING GIN (search_vector)
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS note_chunks_embedding_hnsw_idx
    ON note_chunks USING hnsw (embedding vector_cosine_ops)
  `).catch(() => {
    console.warn("[Chatbot] HNSW index creation skipped (pgvector version may not support it).");
  });

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS note_index_jobs (
      id TEXT PRIMARY KEY,
      "noteId" TEXT NOT NULL,
      "classroomId" TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      "chunksIndexed" INTEGER NOT NULL DEFAULT 0,
      "ocrStatus" TEXT,
      error TEXT,
      "startedAt" TIMESTAMP,
      "completedAt" TIMESTAMP,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS note_index_jobs_classroom_idx
    ON note_index_jobs ("classroomId")
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS note_index_jobs_note_idx
    ON note_index_jobs ("noteId")
  `);
};
