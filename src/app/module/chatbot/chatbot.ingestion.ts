import { randomUUID } from "node:crypto";
import { NoteStatus } from "../../lib/prisma-exports";
import { prisma } from "../../lib/prisma";
import { splitIntoChunks } from "./chatbot.chunk";
import { deleteChunksForNote, insertNoteChunk } from "./chatbot.store";
import { OpenRouterClient } from "./openrouter.client";

const extractPdfText = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      return "";
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const pdfParseModule = await import("pdf-parse");
    const pdfParse =
      "default" in pdfParseModule && pdfParseModule.default
        ? pdfParseModule.default
        : pdfParseModule;
    const parsed = await (pdfParse as (data: Buffer) => Promise<{ text?: string }>)(buffer);
    return typeof parsed.text === "string" ? parsed.text.trim() : "";
  } catch (error) {
    console.error(`[Chatbot] PDF extraction failed for ${url}:`, error);
    return "";
  }
};

const buildNoteCorpus = async (note: {
  title: string;
  description: string | null;
  subject: { name: string };
  folder: { name: string } | null;
  files: Array<{ type: string; url: string; fileName: string | null }>;
}): Promise<string> => {
  const sections = [
    `Title: ${note.title}`,
    note.description ? `Description: ${note.description}` : "",
    `Subject: ${note.subject.name}`,
    note.folder ? `Folder: ${note.folder.name}` : "",
  ].filter(Boolean);

  for (const file of note.files) {
    if (file.type === "pdf") {
      const pdfText = await extractPdfText(file.url);
      if (pdfText) {
        sections.push(
          `PDF (${file.fileName ?? "attachment"}): ${pdfText.slice(0, 12_000)}`,
        );
      }
    } else {
      sections.push(
        `Image file: ${file.fileName ?? "attachment"} (${file.url})`,
      );
    }
  }

  return sections.join("\n\n");
};

const indexNote = async (noteId: string): Promise<{ chunksIndexed: number }> => {
  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      classroomId: true,
      subjectId: true,
      subject: { select: { name: true } },
      folder: { select: { name: true } },
      files: {
        select: { type: true, url: true, fileName: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!note || note.status !== NoteStatus.APPROVED) {
    await deleteChunksForNote(noteId);
    return { chunksIndexed: 0 };
  }

  const corpus = await buildNoteCorpus(note);
  const chunks = splitIntoChunks(corpus);

  await deleteChunksForNote(noteId);

  if (chunks.length === 0) {
    return { chunksIndexed: 0 };
  }

  let indexed = 0;

  for (const [chunkIndex, content] of chunks.entries()) {
    const embedding = await OpenRouterClient.embedText(content);

    await insertNoteChunk({
      id: randomUUID(),
      noteId: note.id,
      classroomId: note.classroomId,
      subjectId: note.subjectId,
      chunkIndex,
      content,
      noteTitle: note.title,
      embedding,
    });

    indexed += 1;
  }

  return { chunksIndexed: indexed };
};

const reindexClassroom = async (
  classroomId: string,
): Promise<{ notesIndexed: number; chunksIndexed: number }> => {
  const notes = await prisma.note.findMany({
    where: { classroomId, status: NoteStatus.APPROVED },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  let chunksIndexed = 0;

  for (const note of notes) {
    const result = await indexNote(note.id);
    chunksIndexed += result.chunksIndexed;
  }

  return { notesIndexed: notes.length, chunksIndexed };
};

export const ChatbotIngestion = {
  indexNote,
  reindexClassroom,
  removeNote: deleteChunksForNote,
};
