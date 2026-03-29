import { ClassroomStatus, MembershipRole } from "../../../generated/prisma";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { StatusCodes } from "http-status-codes";
import { IQueryParams } from "../../interfaces/query.interface";
import {
  IApproveClassroomPayload,
  ICreateClassroomPayload,
  ILeaveClassroomPayload,
  IRejectClassroomPayload,
} from "./classroom.interface";
import { QueryBuilder } from "../../utils/QueryBuilder";
import { generateJoinCode } from "../../utils/generateJoinCode";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Fields the ?searchTerm param will match against (case-insensitive, partial).
 * Dot-notation = one-level relation: "creator.name" → { creator: { name: { contains } } }
 */
const CLASSROOM_SEARCHABLE_FIELDS = [
  "name",
  "institutionName",
  "className",
  "department",
  "creator.name",
  "creator.email",
];

/**
 * Whitelist of direct fields the client may filter on.
 * Any query param NOT in this list is silently ignored by QueryBuilder.filter().
 */
const CLASSROOM_FILTERABLE_FIELDS = [
  "status",
  "level",
  "institutionName",
  "name",
  "className",
  "department",
  "groupName",
];

// ─── Shared select ────────────────────────────────────────────────────────────

/**
 * Safe public shape returned in every classroom response.
 * Keeps creator/resolver to minimal fields — never leaks sensitive user data.
 */
const classroomSelect = {
  id: true,
  name: true,
  institutionName: true,
  level: true,
  className: true,
  department: true,
  groupName: true,
  description: true,
  status: true,
  rejectionReason: true,
  joinCode: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
  creator: {
    select: { id: true, name: true, email: true, image: true },
  },
  resolver: {
    select: { id: true, name: true, email: true, image: true },
  },
} as const;

// ─── Student: Create classroom request ───────────────────────────────────────

/**
 * Any authenticated student can request a new classroom.
 * Status starts as PENDING — the creator becomes CR only on admin approval.
 *
 * One PENDING request per student at a time to prevent spam.
 */
const createClassroom = async (payload: ICreateClassroomPayload) => {
  const existingPending = await prisma.classroom.findFirst({
    where: {
      createdBy: payload.createdBy,
      status: ClassroomStatus.PENDING,
    },
    select: { id: true },
  });

  if (existingPending) {
    throw new AppError(
      StatusCodes.CONFLICT,
      "You already have a pending classroom request. Please wait for it to be reviewed.",
    );
  }

  // ensure uniqueness for joinCode (6 chars)
  let joinCode = generateJoinCode();
  let isUnique = false;
  while (!isUnique) {
    const existing = await prisma.classroom.findFirst({
      where: { joinCode },
      select: { id: true },
    });
    if (!existing) {
      isUnique = true;
    } else {
      joinCode = generateJoinCode();
    }
  }

  return prisma.classroom.create({
    data: {
      name: payload.name,
      institutionName: payload.institutionName,
      level: payload.level,
      className: payload.className ?? null,
      department: payload.department ?? null,
      groupName: payload.groupName ?? null,
      description: payload.description ?? null,
      createdBy: payload.createdBy,
      joinCode,
      status: ClassroomStatus.PENDING,
    },
    select: classroomSelect,
  });
};

// ─── Student: My memberships ──────────────────────────────────────────────────

/**
 * All classrooms the current user is a member of, with their per-classroom role.
 * The frontend uses memberRole to decide whether to render the student view or
 * the CR dashboard for each classroom.
 */
const getMyClassrooms = async (userId: string) => {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: {
      classroom: {
        select: {
          ...classroomSelect,
          _count: { select: { memberships: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return memberships.map((m) => ({
    memberRole: m.role,
    joinedAt: m.createdAt,
    classroom: m.classroom,
  }));
};

const buildLeaderboardForClassrooms = async (
  userId: string,
  classroomIds: string[],
) => {
  if (classroomIds.length === 0) {
    return [];
  }

  const memberships = await prisma.membership.findMany({
    where: {
      userId,
      classroomId: { in: classroomIds },
    },
    include: {
      classroom: {
        select: {
          id: true,
          name: true,
          institutionName: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const [allMembers, notes, comments, favorites] = await Promise.all([
    prisma.membership.findMany({
      where: { classroomId: { in: classroomIds } },
      select: {
        classroomId: true,
        role: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.note.findMany({
      where: { classroomId: { in: classroomIds } },
      select: {
        classroomId: true,
        uploadedBy: true,
        status: true,
      },
    }),
    prisma.comment.findMany({
      where: {
        note: {
          classroomId: { in: classroomIds },
        },
      },
      select: {
        userId: true,
        note: {
          select: {
            classroomId: true,
          },
        },
      },
    }),
    prisma.favorite.findMany({
      where: {
        note: {
          classroomId: { in: classroomIds },
        },
      },
      select: {
        userId: true,
        note: {
          select: {
            classroomId: true,
            uploadedBy: true,
          },
        },
      },
    }),
  ]);

  const scoreMap = new Map<string, {
    userId: string;
    name: string;
    email: string;
    image: string | null;
    memberRole: MembershipRole;
    score: number;
    notesUploaded: number;
    approvedNotes: number;
    commentsCount: number;
    favoritesReceived: number;
  }>();

  for (const member of allMembers) {
    const key = `${member.classroomId}:${member.user.id}`;
    scoreMap.set(key, {
      userId: member.user.id,
      name: member.user.name,
      email: member.user.email,
      image: member.user.image,
      memberRole: member.role,
      score: 0,
      notesUploaded: 0,
      approvedNotes: 0,
      commentsCount: 0,
      favoritesReceived: 0,
    });
  }

  for (const note of notes) {
    const key = `${note.classroomId}:${note.uploadedBy}`;
    const existing = scoreMap.get(key);

    if (!existing) continue;

    existing.notesUploaded += 1;
    existing.score += 10;

    if (note.status === "APPROVED") {
      existing.approvedNotes += 1;
      existing.score += 20;
    }
  }

  for (const comment of comments) {
    const key = `${comment.note.classroomId}:${comment.userId}`;
    const existing = scoreMap.get(key);

    if (!existing) continue;

    existing.commentsCount += 1;
    existing.score += 2;
  }

  for (const favorite of favorites) {
    if (favorite.userId === favorite.note.uploadedBy) {
      continue;
    }

    const key = `${favorite.note.classroomId}:${favorite.note.uploadedBy}`;
    const existing = scoreMap.get(key);

    if (!existing) continue;

    existing.favoritesReceived += 1;
    existing.score += 1;
  }

  return memberships.map((membership) => {
    const classroomMembers = allMembers
      .filter((member) => member.classroomId === membership.classroomId)
      .map((member) => {
        const key = `${member.classroomId}:${member.user.id}`;
        return scoreMap.get(key)!;
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.name.localeCompare(b.name);
      })
      .map((entry, index) => ({
        rank: index + 1,
        ...entry,
      }));

    const myEntry =
      classroomMembers.find((entry) => entry.userId === userId) ?? null;

    return {
      classroom: membership.classroom,
      myMembershipRole: membership.role,
      topMembers: classroomMembers.slice(0, 10),
      allMembers: classroomMembers,
      myRank: myEntry,
      totalMembers: classroomMembers.length,
    };
  });
};

const getMyClassroomLeaderboard = async (userId: string) => {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    select: { classroomId: true },
  });

  return buildLeaderboardForClassrooms(
    userId,
    memberships.map((membership) => membership.classroomId),
  );
};

const getClassroomLeaderboardById = async (userId: string, classroomId: string) => {
  const [leaderboard] = await buildLeaderboardForClassrooms(userId, [classroomId]);

  if (!leaderboard) {
    throw new AppError(StatusCodes.NOT_FOUND, "Leaderboard not found for this classroom");
  }

  return leaderboard;
};

/**
 * All classroom creation requests submitted by this user (any status).
 * Lets the student track pending / rejected requests on their dashboard.
 */
const getMyClassroomRequests = async (userId: string) => {
  return prisma.classroom.findMany({
    where: { createdBy: userId },
    select: classroomSelect,
    orderBy: { createdAt: "desc" },
  });
};

// ─── Admin: List classrooms ───────────────────────────────────────────────────

/**
 * Paginated, searchable, filterable classroom list — admin use only.
 *
 * Accepts standard QueryBuilder params:
 *   ?searchTerm=xyz          — searches across CLASSROOM_SEARCHABLE_FIELDS
 *   ?status=PENDING          — filter by approval status
 *   ?level=UNIVERSITY        — filter by institution level
 *   ?institutionName=xyz     — partial match, case-insensitive
 *   ?page=1&limit=10         — pagination (limit hard-capped at 100)
 *   ?sortBy=createdAt        — field to sort on (dot-notation supported)
 *   ?sortOrder=asc|desc      — sort direction (default: desc)
 *
 * The IQueryParams type is passed directly from req.query in the controller —
 * no manual destructuring needed.
 */
const getClassrooms = async (queryParams: IQueryParams) => {
  return new QueryBuilder(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prisma.classroom as any,
    queryParams,
    {
      searchableFields: CLASSROOM_SEARCHABLE_FIELDS,
      filterableFields: CLASSROOM_FILTERABLE_FIELDS,
    },
  )
    .search()
    .filter()
    .sort()
    .paginate()
    .execute();
};

/**
 * Single classroom detail — member list included.
 * Accessible to admins and members of that classroom.
 */
const getClassroomById = async (classroomId: string) => {
  const classroom = await prisma.classroom.findUnique({
    where: { id: classroomId },
    select: {
      ...classroomSelect,
      memberships: {
        select: {
          role: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      },
      _count: { select: { memberships: true } },
    },
  });

  if (!classroom) {
    throw new AppError(StatusCodes.NOT_FOUND, "Classroom not found");
  }

  return classroom;
};

// ─── Admin: Approve classroom ─────────────────────────────────────────────────

/**
 * Approving a classroom does exactly two things inside a single transaction:
 *   1. Sets classroom.status = APPROVED
 *   2. Upserts a Membership row for the creator with role = CR
 *
 * The creator's global User.role is NOT changed — they remain STUDENT globally.
 * CR privilege is scoped entirely to this classroom via Membership.role.
 *
 * upsert makes the operation idempotent — a double-click by an admin
 * produces no duplicate row and no error.
 */
const approveClassroom = async (payload: IApproveClassroomPayload) => {
  const classroom = await prisma.classroom.findUnique({
    where: { id: payload.classroomId },
    select: { id: true, status: true, createdBy: true },
  });

  if (!classroom) {
    throw new AppError(StatusCodes.NOT_FOUND, "Classroom not found");
  }

  if (classroom.status !== ClassroomStatus.PENDING) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `Classroom is already ${classroom.status.toLowerCase()}`,
    );
  }

  return prisma.$transaction(async (tx) => {
    // 1. Mark as approved and record which admin resolved it
    const approved = await tx.classroom.update({
      where: { id: payload.classroomId },
      data: {
        status: ClassroomStatus.APPROVED,
        resolvedBy: payload.resolvedBy,
        resolvedAt: new Date(),
        rejectionReason: null,
      },
      select: classroomSelect,
    });

    // 2. Give the creator the CR role inside this classroom only
    await tx.membership.upsert({
      where: {
        userId_classroomId: {
          userId: classroom.createdBy,
          classroomId: payload.classroomId,
        },
      },
      create: {
        userId: classroom.createdBy,
        classroomId: payload.classroomId,
        role: MembershipRole.CR,
      },
      update: {
        role: MembershipRole.CR, // idempotent — no-op if already CR
      },
    });

    return approved;
  });
};

// ─── Admin: Reject classroom ──────────────────────────────────────────────────

/**
 * Rejects a pending classroom with a mandatory reason.
 * The student sees this reason on their dashboard so they know what to address.
 */
const rejectClassroom = async (payload: IRejectClassroomPayload) => {
  const classroom = await prisma.classroom.findUnique({
    where: { id: payload.classroomId },
    select: { id: true, status: true },
  });

  if (!classroom) {
    throw new AppError(StatusCodes.NOT_FOUND, "Classroom not found");
  }

  if (classroom.status !== ClassroomStatus.PENDING) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `Classroom is already ${classroom.status.toLowerCase()}`,
    );
  }

  return prisma.classroom.update({
    where: { id: payload.classroomId },
    data: {
      status: ClassroomStatus.REJECTED,
      rejectionReason: payload.rejectionReason,
      resolvedBy: payload.resolvedBy,
      resolvedAt: new Date(),
    },
    select: classroomSelect,
  });
};

// ─── Student: Join classroom via code ─────────────────────────────────────────

/**
 * Any student can join an APPROVED classroom if they have the unique joinCode.
 * They join as a regular STUDENT; CR status is only granted on approval of
 * the request.
 */
const joinClassroom = async (payload: {
  userId: string;
  joinCode: string;
}) => {
  const classroom = await prisma.classroom.findUnique({
    where: { joinCode: payload.joinCode },
    select: { id: true, status: true },
  });

  if (!classroom) {
    throw new AppError(
      StatusCodes.NOT_FOUND,
      "No classroom found with that join code.",
    );
  }

  if (classroom.status !== ClassroomStatus.APPROVED) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "This classroom is still pending or was rejected.",
    );
  }

  const existing = await prisma.membership.findUnique({
    where: {
      userId_classroomId: {
        userId: payload.userId,
        classroomId: classroom.id,
      },
    },
    select: { id: true },
  });

  if (existing) {
    throw new AppError(
      StatusCodes.CONFLICT,
      "You are already a member of this classroom.",
    );
  }

  return prisma.membership.create({
    data: {
      userId: payload.userId,
      classroomId: classroom.id,
      role: MembershipRole.STUDENT,
    },
    include: {
      classroom: { select: classroomSelect },
    },
  });
};

const leaveClassroom = async (payload: ILeaveClassroomPayload) => {
  const membership = await prisma.membership.findUnique({
    where: {
      userId_classroomId: {
        userId: payload.userId,
        classroomId: payload.classroomId,
      },
    },
    select: {
      id: true,
      role: true,
      classroomId: true,
      classroom: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!membership) {
    throw new AppError(StatusCodes.NOT_FOUND, "You are not a member of this classroom.");
  }

  if (membership.role === MembershipRole.CR) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "Class representatives cannot leave their own classroom from here.",
    );
  }

  await prisma.membership.delete({
    where: {
      userId_classroomId: {
        userId: payload.userId,
        classroomId: payload.classroomId,
      },
    },
  });

  return {
    classroomId: membership.classroomId,
    classroomName: membership.classroom.name,
  };
};

// ─── Exports ──────────────────────────────────────────────────────────────────

export const ClassroomService = {
  createClassroom,
  getMyClassrooms,
  getMyClassroomLeaderboard,
  getClassroomLeaderboardById,
  getMyClassroomRequests,
  getClassrooms,
  getClassroomById,
  approveClassroom,
  rejectClassroom,
  joinClassroom,
  leaveClassroom,
};
