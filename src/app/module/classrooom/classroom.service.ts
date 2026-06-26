import { ClassroomStatus, MembershipRole } from "../../lib/prisma-exports";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { withMembershipListCache, invalidateMembershipListCache } from "../../lib/membership-list.cache";
import { StatusCodes } from "http-status-codes";
import { IQueryParams } from "../../interfaces/query.interface";
import {
  IApproveClassroomPayload,
  ICreateClassroomPayload,
  ILeaveClassroomPayload,
  IRejectClassroomPayload,
  IUpdateClassroomStatusPayload,
  IUpdateClassroomMemberRolePayload,
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

// ─── Student: Create classroom ───────────────────────────────────────────────

/**
 * Creates a classroom immediately as APPROVED and assigns the creator as CR.
 */
const createClassroom = async (payload: ICreateClassroomPayload) => {
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

  return prisma.$transaction(async (tx) => {
    const classroom = await tx.classroom.create({
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
        status: ClassroomStatus.APPROVED,
      },
      select: classroomSelect,
    });

    await tx.membership.create({
      data: {
        userId: payload.createdBy,
        classroomId: classroom.id,
        role: MembershipRole.CR,
      },
    });

    return classroom;
  }).then((classroom) => {
    invalidateMembershipListCache(payload.createdBy);
    return classroom;
  });
};

// ─── Student: My memberships ──────────────────────────────────────────────────

/**
 * All classrooms the current user is a member of, with their per-classroom role.
 * The frontend uses memberRole to decide whether to render the student view or
 * the CR dashboard for each classroom.
 */
const getMyClassrooms = async (userId: string) => {
  return withMembershipListCache(userId, async () => {
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
  });
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

const getClassroomMembers = async (classroomId: string) => {
  const classroom = await prisma.classroom.findUnique({
    where: { id: classroomId },
    select: {
      ...classroomSelect,
      memberships: {
        orderBy: [
          { role: "asc" },
          { createdAt: "asc" },
        ],
        select: {
          role: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
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

const updateClassroomMemberRole = async (payload: IUpdateClassroomMemberRolePayload) => {
  const { classroomId, actingUserId, targetUserId, role } = payload;

  const [actingMembership, targetMembership] = await Promise.all([
    prisma.membership.findUnique({
      where: {
        userId_classroomId: {
          userId: actingUserId,
          classroomId,
        },
      },
      select: { role: true },
    }),
    prisma.membership.findUnique({
      where: {
        userId_classroomId: {
          userId: targetUserId,
          classroomId,
        },
      },
      select: {
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
    }),
  ]);

  if (!actingMembership || actingMembership.role !== MembershipRole.CR) {
    throw new AppError(StatusCodes.FORBIDDEN, "Only CR can manage classroom members");
  }

  if (!targetMembership) {
    throw new AppError(StatusCodes.NOT_FOUND, "Target member not found in this classroom");
  }

  if (targetMembership.role === role) {
    return {
      role,
      user: targetMembership.user,
    };
  }

  if (targetMembership.role === MembershipRole.CR && role === MembershipRole.STUDENT) {
    const crCount = await prisma.membership.count({
      where: {
        classroomId,
        role: MembershipRole.CR,
      },
    });

    if (crCount <= 1) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        "You cannot demote the last CR of this classroom",
      );
    }
  }

  const updatedMembership = await prisma.membership.update({
    where: {
      userId_classroomId: {
        userId: targetUserId,
        classroomId,
      },
    },
    data: {
      role,
    },
    select: {
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
  });

  return updatedMembership;
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
  const normalizedJoinCode = payload.joinCode.trim().toUpperCase();

  const classroom = await prisma.classroom.findFirst({
    where: {
      joinCode: {
        equals: normalizedJoinCode,
        mode: "insensitive",
      },
    },
    select: { id: true, status: true },
  });

  if (!classroom) {
    throw new AppError(
      StatusCodes.NOT_FOUND,
      "No classroom found with that join code.",
    );
  }

  if (classroom.status === ClassroomStatus.INACTIVE) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "This classroom is currently inactive.",
    );
  }

  if (classroom.status === ClassroomStatus.BANNED) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "This classroom has been banned.",
    );
  }

  if (classroom.status !== ClassroomStatus.APPROVED) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "This classroom is not available to join.",
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

  const membership = await prisma.membership.create({
    data: {
      userId: payload.userId,
      classroomId: classroom.id,
      role: MembershipRole.STUDENT,
    },
    include: {
      classroom: { select: classroomSelect },
    },
  });

  invalidateMembershipListCache(payload.userId);
  return membership;
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

  invalidateMembershipListCache(payload.userId);

  return {
    classroomId: membership.classroomId,
    classroomName: membership.classroom.name,
  };
};

// ─── Admin: Update classroom status ───────────────────────────────────────────

const updateClassroomStatus = async (payload: IUpdateClassroomStatusPayload) => {
  const allowedStatuses: ClassroomStatus[] = [
    ClassroomStatus.APPROVED,
    ClassroomStatus.INACTIVE,
    ClassroomStatus.BANNED,
  ];

  if (!allowedStatuses.includes(payload.status)) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "Status must be APPROVED, INACTIVE, or BANNED",
    );
  }

  const classroom = await prisma.classroom.findUnique({
    where: { id: payload.classroomId },
    select: { id: true },
  });

  if (!classroom) {
    throw new AppError(StatusCodes.NOT_FOUND, "Classroom not found");
  }

  return prisma.classroom.update({
    where: { id: payload.classroomId },
    data: {
      status: payload.status,
      rejectionReason: payload.reason ?? null,
      resolvedBy: payload.resolvedBy,
      resolvedAt: new Date(),
    },
    select: classroomSelect,
  });
};

// ─── Admin: Delete classroom ──────────────────────────────────────────────────

const deleteClassroom = async (classroomId: string) => {
  const classroom = await prisma.classroom.findUnique({
    where: { id: classroomId },
    select: { id: true, name: true },
  });

  if (!classroom) {
    throw new AppError(StatusCodes.NOT_FOUND, "Classroom not found");
  }

  await prisma.$transaction(async (tx) => {
    const notes = await tx.note.findMany({
      where: { classroomId },
      select: { id: true },
    });
    const noteIds = notes.map((note) => note.id);

    if (noteIds.length > 0) {
      await tx.noteFile.deleteMany({ where: { noteId: { in: noteIds } } });
      await tx.note.deleteMany({ where: { id: { in: noteIds } } });
    }

    const subjects = await tx.subject.findMany({
      where: { classroomId },
      select: { id: true },
    });
    const subjectIds = subjects.map((subject) => subject.id);

    if (subjectIds.length > 0) {
      await tx.folder.deleteMany({ where: { subjectId: { in: subjectIds } } });
    }

    await tx.subject.deleteMany({ where: { classroomId } });
    await tx.chatMessage.deleteMany({
      where: { session: { classroomId } },
    });
    await tx.chatSession.deleteMany({ where: { classroomId } });
    await tx.membership.deleteMany({ where: { classroomId } });
    await tx.classroom.delete({ where: { id: classroomId } });
  });

  return { id: classroom.id, name: classroom.name };
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
  getClassroomMembers,
  updateClassroomMemberRole,
  approveClassroom,
  rejectClassroom,
  updateClassroomStatus,
  deleteClassroom,
  joinClassroom,
  leaveClassroom,
};
