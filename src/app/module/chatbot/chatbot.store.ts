import { prisma } from "../../lib/prisma";
import { ensureChatbotInfrastructure } from "./chatbot.bootstrap";
export type NoteChunkRecord = {
  id: string;
  noteId: string;
  classroomId: string;
  subjectId: string;
  chunkIndex: number;
  content: string;
  noteTitle: string;
  similarity: number;
};

export const ensureChatbotTables = async (): Promise<void> => {
  await ensureChatbotInfrastructure();
};

const toVectorLiteral = (embedding: number[]): string =>
  `[${embedding.join(",")}]`;

export const deleteChunksForNote = async (noteId: string): Promise<void> => {
  await ensureChatbotTables();
  await prisma.$executeRawUnsafe(`DELETE FROM note_chunks WHERE "noteId" = $1`, noteId);
};

export const insertNoteChunk = async (payload: {
  id: string;
  noteId: string;
  classroomId: string;
  subjectId: string;
  chunkIndex: number;
  content: string;
  noteTitle: string;
  embedding: number[];
}): Promise<void> => {
  await ensureChatbotTables();

  await prisma.$executeRawUnsafe(
    `INSERT INTO note_chunks (
      id, "noteId", "classroomId", "subjectId", "chunkIndex", content, "noteTitle", embedding, "createdAt", "updatedAt"
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector, NOW(), NOW())`,
    payload.id,
    payload.noteId,
    payload.classroomId,
    payload.subjectId,
    payload.chunkIndex,
    payload.content,
    payload.noteTitle,
    toVectorLiteral(payload.embedding),
  );
};

export const searchSimilarChunks = async (payload: {
  classroomId: string;
  subjectId?: string;
  noteId?: string;
  embedding: number[];
  topK: number;
  minSimilarity: number;
}): Promise<NoteChunkRecord[]> => {
  await ensureChatbotTables();

  const filters = [`nc."classroomId" = $2`];
  const params: unknown[] = [
    toVectorLiteral(payload.embedding),
    payload.classroomId,
  ];

  if (payload.subjectId) {
    params.push(payload.subjectId);
    filters.push(`nc."subjectId" = $${params.length}`);
  }

  if (payload.noteId) {
    params.push(payload.noteId);
    filters.push(`nc."noteId" = $${params.length}`);
  }

  params.push(payload.topK);
  const limitParam = `$${params.length}`;

  const maxDistance = 1 - payload.minSimilarity;

  const rows = await prisma.$queryRawUnsafe<NoteChunkRecord[]>(
    `SELECT
      nc.id,
      nc."noteId",
      nc."classroomId",
      nc."subjectId",
      nc."chunkIndex",
      nc.content,
      nc."noteTitle",
      (1 - (nc.embedding <=> $1::vector))::float8 AS similarity
    FROM note_chunks nc
    WHERE ${filters.join(" AND ")}
      AND (nc.embedding <=> $1::vector) <= ${maxDistance}
    ORDER BY nc.embedding <=> $1::vector
    LIMIT ${limitParam}`,
    ...params,
  );

  return rows;
};
