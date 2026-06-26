import { randomUUID } from "node:crypto";
import { NoteStatus } from "../../lib/prisma-exports";
import { prisma } from "../../lib/prisma";
import { splitIntoChunks } from "./chatbot.chunk";
import {
  createIndexJob,
  deleteChunksForNote,
  insertNoteChunk,
  updateIndexJob,
} from "./chatbot.store";
import { OpenRouterClient } from "./openrouter.client";
import { enqueueChatbotJob } from "./chatbot.queue";

const extractPdfText = async (url: string): Promise<{ text: string; pages: string[] }> => {
  try {
    const response = await fetch(url);
    if (!response.ok) return { text: "", pages: [] };

    const buffer = Buffer.from(await response.arrayBuffer());
    const pdfParseModule = await import("pdf-parse");
    const pdfParse =
      "default" in pdfParseModule && pdfParseModule.default
        ? pdfParseModule.default
        : pdfParseModule;
    const parsed = await (pdfParse as (data: Buffer) => Promise<{ text?: string; numpages?: number }>)(buffer);
    const fullText = typeof parsed.text === "string" ? parsed.text.trim() : "";

    if (!fullText) return { text: "", pages: [] };

    const pageCount = parsed.numpages ?? 1;
    const approxPageSize = Math.ceil(fullText.length / pageCount);
    const pages: string[] = [];

    for (let page = 0; page < pageCount; page += 1) {
      pages.push(fullText.slice(page * approxPageSize, (page + 1) * approxPageSize));
    }

    return { text: fullText, pages };
  } catch (error) {
    console.error(`[Chatbot] PDF extraction failed for ${url}:`, error);
    return { text: "", pages: [] };
  }
};

const extractImageText = async (url: string): Promise<string> => {
  try {
    return await OpenRouterClient.describeImage(url);
  } catch (error) {
    console.error(`[Chatbot] Image OCR failed for ${url}:`, error);
    return "";
  }
};

const buildNoteCorpus = async (note: {
  title: string;
  description: string | null;
  subject: { name: string };
  folder: { name: string } | null;
  files: Array<{ type: string; url: string; fileName: string | null }>;
}): Promise<{ corpus: string; ocrStatus: string; pageTexts: string[] }> => {
  const sections = [
    `Title: ${note.title}`,
    note.description ? `Description: ${note.description}` : "",
    `Subject: ${note.subject.name}`,
    note.folder ? `Folder: ${note.folder.name}` : "",
  ].filter(Boolean);

  const pageTexts: string[] = [];
  let ocrApplied = false;
  let ocrFailed = false;

  for (const file of note.files) {
    if (file.type === "pdf") {
      const { text, pages } = await extractPdfText(file.url);
      if (text) {
        sections.push(`PDF (${file.fileName ?? "attachment"}):\n${text}`);
        pageTexts.push(...pages);
      }
    } else if (file.type === "image") {
      const imageText = await extractImageText(file.url);
      ocrApplied = true;
      if (imageText) {
        sections.push(`Image (${file.fileName ?? "attachment"}):\n${imageText}`);
        pageTexts.push(imageText);
      } else {
        ocrFailed = true;
        sections.push(
          `Image file: ${file.fileName ?? "attachment"} (${file.url})`,
        );
      }
    } else {
      sections.push(
        `Attachment: ${file.fileName ?? "file"} (${file.url})`,
      );
    }
  }

  const ocrStatus = ocrApplied
    ? ocrFailed
      ? "partial"
      : "completed"
    : "not_needed";

  return {
    corpus: sections.join("\n\n"),
    ocrStatus,
    pageTexts,
  };
};

const indexNote = async (noteId: string): Promise<{ chunksIndexed: number }> => {
  const jobId = randomUUID();

  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      classroomId: true,
      subjectId: true,
      folderId: true,
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

  await createIndexJob({
    id: jobId,
    noteId: note.id,
    classroomId: note.classroomId,
  });

  await updateIndexJob(jobId, {
    status: "processing",
    startedAt: new Date(),
  });

  try {
    const { corpus, ocrStatus, pageTexts } = await buildNoteCorpus(note);
    const chunks = splitIntoChunks(corpus);

    await deleteChunksForNote(noteId);

    if (chunks.length === 0) {
      await updateIndexJob(jobId, {
        status: "completed",
        chunksIndexed: 0,
        ocrStatus,
        completedAt: new Date(),
      });
      return { chunksIndexed: 0 };
    }

    const embeddings = await OpenRouterClient.embedTexts(chunks);

    for (const [chunkIndex, content] of chunks.entries()) {
      const pageNumber =
        pageTexts.length > 0
          ? Math.min(
              pageTexts.length,
              Math.floor((chunkIndex / chunks.length) * pageTexts.length) + 1,
            )
          : null;

      await insertNoteChunk({
        id: randomUUID(),
        noteId: note.id,
        classroomId: note.classroomId,
        subjectId: note.subjectId,
        folderId: note.folderId,
        chunkIndex,
        content,
        noteTitle: note.title,
        pageNumber,
        embedding: embeddings[chunkIndex]!,
      });
    }

    await updateIndexJob(jobId, {
      status: "completed",
      chunksIndexed: chunks.length,
      ocrStatus,
      completedAt: new Date(),
    });

    return { chunksIndexed: chunks.length };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown indexing error";

    await updateIndexJob(jobId, {
      status: "failed",
      error: message,
      completedAt: new Date(),
    });

    throw error;
  }
};

const queueIndexNote = (noteId: string): void => {
  enqueueChatbotJob(async () => {
    await indexNote(noteId).catch((error) => {
      console.error(`[Chatbot] Failed to index note ${noteId}:`, error);
    });
  });
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

const queueReindexClassroom = (classroomId: string): void => {
  enqueueChatbotJob(async () => {
    await reindexClassroom(classroomId).catch((error) => {
      console.error(
        `[Chatbot] Failed to reindex classroom ${classroomId}:`,
        error,
      );
    });
  });
};

export const ChatbotIngestion = {
  indexNote,
  queueIndexNote,
  reindexClassroom,
  queueReindexClassroom,
  removeNote: deleteChunksForNote,
};
