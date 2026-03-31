import { StatusCodes } from "http-status-codes";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { IToggleNoticePayload, IUpsertNoticePayload } from "./notice.interface";

type NoticeRecord = {
  id: string;
  content: string;
  isActive: boolean;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const NOTICE_ID = "global-classroom-notice";

const ensureNoticeTable = async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS notices (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      "isActive" BOOLEAN NOT NULL DEFAULT false,
      "updatedBy" TEXT,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
};

const getCurrentNotice = async (): Promise<NoticeRecord | null> => {
  await ensureNoticeTable();

  const result = await prisma.$queryRawUnsafe<NoticeRecord[]>(
    `SELECT id, content, "isActive", "updatedBy", "createdAt", "updatedAt"
     FROM notices
     WHERE id = $1
     LIMIT 1`,
    NOTICE_ID,
  );

  return result[0] ?? null;
};

const upsertNotice = async (payload: IUpsertNoticePayload): Promise<NoticeRecord> => {
  await ensureNoticeTable();

  const result = await prisma.$queryRawUnsafe<NoticeRecord[]>(
    `INSERT INTO notices (id, content, "isActive", "updatedBy", "createdAt", "updatedAt")
     VALUES ($1, $2, COALESCE((SELECT "isActive" FROM notices WHERE id = $1), false), $3, NOW(), NOW())
     ON CONFLICT (id)
     DO UPDATE SET
       content = EXCLUDED.content,
       "updatedBy" = EXCLUDED."updatedBy",
       "updatedAt" = NOW()
     RETURNING id, content, "isActive", "updatedBy", "createdAt", "updatedAt"`,
    NOTICE_ID,
    payload.content,
    payload.updatedBy,
  );

  const notice = result[0];
  if (!notice) {
    throw new AppError(StatusCodes.INTERNAL_SERVER_ERROR, "Failed to save notice");
  }

  return notice;
};

const toggleNotice = async (payload: IToggleNoticePayload): Promise<NoticeRecord> => {
  await ensureNoticeTable();

  const existing = await getCurrentNotice();

  if (!existing) {
    throw new AppError(StatusCodes.NOT_FOUND, "No notice found to toggle");
  }

  const result = await prisma.$queryRawUnsafe<NoticeRecord[]>(
    `UPDATE notices
     SET "isActive" = $2, "updatedBy" = $3, "updatedAt" = NOW()
     WHERE id = $1
     RETURNING id, content, "isActive", "updatedBy", "createdAt", "updatedAt"`,
    NOTICE_ID,
    payload.isActive,
    payload.updatedBy,
  );

  const notice = result[0];
  if (!notice) {
    throw new AppError(StatusCodes.INTERNAL_SERVER_ERROR, "Failed to update notice");
  }

  return notice;
};

export const NoticeService = {
  getCurrentNotice,
  upsertNotice,
  toggleNotice,
};
