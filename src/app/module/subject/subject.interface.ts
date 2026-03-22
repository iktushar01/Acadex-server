// ─── Create ───────────────────────────────────────────────────────────────────

export interface ICreateSubjectPayload {
  /** Resolved from JWT — never accepted from request body */
  userId: string;
  name: string;
  classroomId: string;
}

// ─── Update ───────────────────────────────────────────────────────────────────

export interface IUpdateSubjectPayload {
  /** Resolved from JWT */
  userId: string;
  /** Route param */
  subjectId: string;
  name: string;
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export interface IDeleteSubjectPayload {
  /** Resolved from JWT */
  userId: string;
  subjectId: string;
}

// ─── Query ────────────────────────────────────────────────────────────────────

export interface IGetSubjectsPayload {
  /** Resolved from JWT */
  userId: string;
  classroomId: string;
}