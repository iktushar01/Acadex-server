import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { ClassroomStatus, MembershipRole } from "../../lib/prisma-exports";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { IRequestUser } from "../auth/auth.interface";

/**
 * checkClassroomRole — per-classroom role guard
 *
 * Reads ClassroomMember.role, NOT User.role.
 * Always used AFTER checkAuth (which validates the JWT).
 *
 * Usage:
 *   router.post(
 *     "/:classroomId/subjects",
 *     checkAuth(Role.STUDENT),
 *     checkClassroomRole(MembershipRole.CR),   // CR of THIS classroom only
 *     SubjectController.create,
 *   );
 *
 * Populates req.classroomMember so controllers don't re-query.
 * classroomId must be a route param named exactly "classroomId".
 */
export const checkClassroomRole = (...allowedRoles: MembershipRole[]) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = req.user as IRequestUser;
      const { classroomId } = req.params;

      if (!classroomId) {
        throw new AppError(
          StatusCodes.BAD_REQUEST,
          "classroomId param is required",
        );
      }

      // Verify the classroom exists and is active
      const classroom = await prisma.classroom.findUnique({
        where: { id: classroomId as string },
        select: { id: true, status: true },
      });

      if (!classroom) {
        throw new AppError(StatusCodes.NOT_FOUND, "Classroom not found");
      }

      if (classroom.status !== ClassroomStatus.APPROVED) {
        throw new AppError(
          StatusCodes.FORBIDDEN,
          "This classroom is not yet active",
        );
      }

      // Check membership and role inside this classroom
      const membership = await prisma.membership.findUnique({
        where: {
          userId_classroomId: {
            userId: user.userId,
            classroomId: classroomId as string,
          },
        },
        select: { userId: true, classroomId: true, role: true },
      });

      if (!membership) {
        throw new AppError(
          StatusCodes.FORBIDDEN,
          "You are not a member of this classroom",
        );
      }

      if (!allowedRoles.includes(membership.role)) {
        throw new AppError(
          StatusCodes.FORBIDDEN,
          `This action requires the ${allowedRoles.join(" or ")} role inside this classroom`,
        );
      }

      // Attach for downstream use — no second DB call needed in controllers
      (req as any).classroomMember = {
        userId: membership.userId,
        classroomId: membership.classroomId,
        memberRole: membership.role,
      };

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * checkClassroomMember — any membership role (STUDENT or CR)
 *
 * Convenience wrapper for read-only endpoints accessible to all members.
 *
 * Usage:
 *   router.get("/:classroomId/notes", checkAuth(...), checkClassroomMember(), ...)
 */
export const checkClassroomMember = () =>
  checkClassroomRole(MembershipRole.STUDENT, MembershipRole.CR);
