import { prisma } from "../../lib/prisma";
import { ensureChatbotInfrastructure } from "./chatbot.bootstrap";
import type { IndexJobRecord } from "./chatbot.interface";

export type NoteChunkRecord = {
  id: string;
  noteId: string;
  classroomId: string;
  subjectId: string;
  folderId: string | null;
  chunkIndex: number;
  content: string;
  noteTitle: string;
  pageNumber: number | null;
  similarity: number;
  keywordScore: number;
  combinedScore: number;
};

export const ensureChatbotTables = async (): Promise<void> => {
  await ensureChatbotInfrastructure();
};

const toVectorLiteral = (embedding: number[]): string =>
  `[${embedding.join(",")}]`;

export const deleteChunksForNote = async (noteId: string): Promise<void> => {
  await ensureChatbotTables();
  await prisma.$executeRawUnsafe(
    `DELETE FROM note_chunks WHERE "noteId" = $1`,
    noteId,
  );
};

export const insertNoteChunk = async (payload: {
  id: string;
  noteId: string;
  classroomId: string;
  subjectId: string;
  folderId?: string | null;
  chunkIndex: number;
  content: string;
  noteTitle: string;
  pageNumber?: number | null;
  embedding: number[];
}): Promise<void> => {
  await ensureChatbotTables();

  await prisma.$executeRawUnsafe(
    `INSERT INTO note_chunks (
      id, "noteId", "classroomId", "subjectId", "folderId", "chunkIndex",
      content, "noteTitle", "pageNumber", embedding, search_vector,
      "createdAt", "updatedAt"
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::vector,
      to_tsvector('english', $7), NOW(), NOW()
    )`,
    payload.id,
    payload.noteId,
    payload.classroomId,
    payload.subjectId,
    payload.folderId ?? null,
    payload.chunkIndex,
    payload.content,
    payload.noteTitle,
    payload.pageNumber ?? null,
    toVectorLiteral(payload.embedding),
  );
};

export const searchSimilarChunks = async (payload: {
  classroomId: string;
  subjectId?: string;
  noteId?: string;
  folderId?: string;
  embedding: number[];
  keywordQuery: string;
  topK: number;
  minSimilarity: number;
}): Promise<NoteChunkRecord[]> => {
  await ensureChatbotTables();

  const filters = [`nc."classroomId" = $2`];
  const params: unknown[] = [
    toVectorLiteral(payload.embedding),
    payload.classroomId,
    payload.keywordQuery,
  ];

  if (payload.subjectId) {
    params.push(payload.subjectId);
    filters.push(`nc."subjectId" = $${params.length}`);
  }

  if (payload.noteId) {
    params.push(payload.noteId);
    filters.push(`nc."noteId" = $${params.length}`);
  }

  if (payload.folderId) {
    params.push(payload.folderId);
    filters.push(`nc."folderId" = $${params.length}`);
  }

  params.push(payload.topK);
  const limitParam = `$${params.length}`;

  const maxDistance = 1 - payload.minSimilarity;
  const vectorWeight = 0.7;
  const keywordWeight = 0.3;

  const rows = await prisma.$queryRawUnsafe<NoteChunkRecord[]>(
    `SELECT
      nc.id,
      nc."noteId",
      nc."classroomId",
      nc."subjectId",
      nc."folderId",
      nc."chunkIndex",
      nc.content,
      nc."noteTitle",
      nc."pageNumber",
      (1 - (nc.embedding <=> $1::vector))::float8 AS similarity,
      COALESCE(ts_rank(nc.search_vector, plainto_tsquery('english', $3)), 0)::float8 AS "keywordScore",
      (
        ${vectorWeight} * (1 - (nc.embedding <=> $1::vector)) +
        ${keywordWeight} * COALESCE(ts_rank(nc.search_vector, plainto_tsquery('english', $3)), 0)
      )::float8 AS "combinedScore"
    FROM note_chunks nc
    WHERE ${filters.join(" AND ")}
      AND (
        (nc.embedding <=> $1::vector) <= ${maxDistance}
        OR nc.search_vector @@ plainto_tsquery('english', $3)
      )
    ORDER BY "combinedScore" DESC
    LIMIT ${limitParam}`,
    ...params,
  );

  return rows;
};

export const countChunksForClassroom = async (
  classroomId: string,
): Promise<number> => {
  await ensureChatbotTables();
  const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*)::bigint AS count FROM note_chunks WHERE "classroomId" = $1`,
    classroomId,
  );
  return Number(rows[0]?.count ?? 0);
};

export const createIndexJob = async (payload: {
  id: string;
  noteId: string;
  classroomId: string;
}): Promise<void> => {
  await ensureChatbotTables();
  await prisma.$executeRawUnsafe(
    `INSERT INTO note_index_jobs (id, "noteId", "classroomId", status, "createdAt")
     VALUES ($1, $2, $3, 'pending', NOW())`,
    payload.id,
    payload.noteId,
    payload.classroomId,
  );
};

export const updateIndexJob = async (
  jobId: string,
  update: {
    status?: string;
    chunksIndexed?: number;
    ocrStatus?: string | null;
    error?: string | null;
    startedAt?: Date | null;
    completedAt?: Date | null;
  },
): Promise<void> => {
  await ensureChatbotTables();

  const sets: string[] = [];
  const params: unknown[] = [jobId];
  let paramIndex = 2;

  if (update.status !== undefined) {
    sets.push(`status = $${paramIndex++}`);
    params.push(update.status);
  }
  if (update.chunksIndexed !== undefined) {
    sets.push(`"chunksIndexed" = $${paramIndex++}`);
    params.push(update.chunksIndexed);
  }
  if (update.ocrStatus !== undefined) {
    sets.push(`"ocrStatus" = $${paramIndex++}`);
    params.push(update.ocrStatus);
  }
  if (update.error !== undefined) {
    sets.push(`error = $${paramIndex++}`);
    params.push(update.error);
  }
  if (update.startedAt !== undefined) {
    sets.push(`"startedAt" = $${paramIndex++}`);
    params.push(update.startedAt);
  }
  if (update.completedAt !== undefined) {
    sets.push(`"completedAt" = $${paramIndex++}`);
    params.push(update.completedAt);
  }

  if (sets.length === 0) return;

  await prisma.$executeRawUnsafe(
    `UPDATE note_index_jobs SET ${sets.join(", ")} WHERE id = $1`,
    ...params,
  );
};

export const getRecentIndexJobs = async (
  classroomId: string,
  limit = 20,
): Promise<IndexJobRecord[]> => {
  await ensureChatbotTables();

  const rows = await prisma.$queryRawUnsafe<
    Array<IndexJobRecord & { noteTitle: string | null }>
  >(
    `SELECT
      j.id,
      j."noteId",
      j."classroomId",
      j.status,
      j."chunksIndexed",
      j."ocrStatus",
      j.error,
      j."startedAt",
      j."completedAt",
      j."createdAt",
      n.title AS "noteTitle"
    FROM note_index_jobs j
    LEFT JOIN notes n ON n.id = j."noteId"
    WHERE j."classroomId" = $1
    ORDER BY j."createdAt" DESC
    LIMIT $2`,
    classroomId,
    limit,
  );

  return rows.map((row) => ({
    id: row.id,
    noteId: row.noteId,
    classroomId: row.classroomId,
    status: row.status as IndexJobRecord["status"],
    chunksIndexed: row.chunksIndexed,
    ocrStatus: row.ocrStatus,
    error: row.error,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    noteTitle: row.noteTitle ?? undefined,
  }));
};

export const getLastReindexTime = async (
  classroomId: string,
): Promise<Date | null> => {
  await ensureChatbotTables();
  const rows = await prisma.$queryRawUnsafe<Array<{ completedAt: Date | null }>>(
    `SELECT MAX("completedAt") AS "completedAt"
     FROM note_index_jobs
     WHERE "classroomId" = $1 AND status = 'completed'`,
    classroomId,
  );
  return rows[0]?.completedAt ?? null;
};
