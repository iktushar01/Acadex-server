CREATE TABLE IF NOT EXISTS "group_messages" (
  "id" TEXT NOT NULL,
  "classroomId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "group_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "group_messages_classroomId_createdAt_idx"
  ON "group_messages"("classroomId", "createdAt");

CREATE INDEX IF NOT EXISTS "group_messages_classroomId_idx"
  ON "group_messages"("classroomId");

DO $$ BEGIN
  ALTER TABLE "group_messages"
    ADD CONSTRAINT "group_messages_classroomId_fkey"
    FOREIGN KEY ("classroomId") REFERENCES "classrooms"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "group_messages"
    ADD CONSTRAINT "group_messages_senderId_fkey"
    FOREIGN KEY ("senderId") REFERENCES "user"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
