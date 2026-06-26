import { NextFunction, Request, Response } from "express";
import AppError from "../errorHelpers/AppError";
import { prisma } from "../lib/prisma";
import { jwtUtils } from "../utils/jwt";
import { cookieUtils } from "../utils/cookies";
import { Role, UserStatus } from "../lib/prisma-exports";
import { StatusCodes } from "http-status-codes";
import { envVars } from "../../config/env";
import { IRequestUser } from "../module/auth/auth.interface";

const assertActiveUser = (
  user: Pick<IRequestUser, "role" | "status" | "isDeleted">,
  authRoles: Role[],
) => {
  if (user.status === UserStatus.SUSPENDED || user.status === UserStatus.DELETED) {
    throw new AppError(StatusCodes.UNAUTHORIZED, "Unauthorized access! User is not active.");
  }

  if (user.isDeleted) {
    throw new AppError(StatusCodes.UNAUTHORIZED, "Unauthorized access! User is deleted.");
  }

  if (authRoles.length > 0 && !authRoles.includes(user.role)) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      "Forbidden access! You do not have permission to access this resource.",
    );
  }
};

export const checkAuth =
  (...authRoles: Role[]) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      const bearerToken = authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7)
        : undefined;
      const accessToken =
        cookieUtils.getCookie(req, "accessToken") ?? bearerToken;

      // Fast path: verify JWT locally — no database round trip
      if (accessToken) {
        const verifiedToken = jwtUtils.verifyToken(
          accessToken,
          envVars.ACCESS_TOKEN_SECRET,
        );

        if (verifiedToken.success && verifiedToken.decoded) {
          const decoded = verifiedToken.decoded as IRequestUser;
          assertActiveUser(decoded, authRoles);
          req.user = decoded;
          return next();
        }
      }

      // Fallback: Better Auth session cookie
      const sessionToken = cookieUtils.getCookie(req, "better-auth.session_token");

      if (sessionToken) {
        const sessionExists = await prisma.session.findUnique({
          where: { token: sessionToken },
          select: {
            expiresAt: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                role: true,
                status: true,
                isDeleted: true,
                name: true,
                email: true,
                emailVerified: true,
              },
            },
          },
        });

        if (sessionExists && sessionExists.expiresAt > new Date()) {
          const user = sessionExists.user;

          const now = new Date();
          const expiresAt = new Date(sessionExists.expiresAt);
          const createdAt = new Date(sessionExists.createdAt);
          const sessionLifeTime = expiresAt.getTime() - createdAt.getTime();
          const timeRemaining = expiresAt.getTime() - now.getTime();
          const percentRemaining = (timeRemaining / sessionLifeTime) * 100;

          if (percentRemaining < 20) {
            res.setHeader("X-Session-Refresh", "true");
            res.setHeader("X-Session-Expires-At", expiresAt.toISOString());
            res.setHeader("X-Time-Remaining", timeRemaining.toString());
          }

          assertActiveUser(
            {
              role: user.role,
              status: user.status,
              isDeleted: user.isDeleted,
            },
            authRoles,
          );

          req.user = {
            userId: user.id,
            role: user.role,
            name: user.name,
            email: user.email,
            status: user.status,
            isDeleted: user.isDeleted,
            emailVerified: user.emailVerified,
            iat: 0,
            exp: 0,
          };

          return next();
        }
      }

      throw new AppError(
        StatusCodes.UNAUTHORIZED,
        "Unauthorized access! No access token provided.",
      );
    } catch (error: unknown) {
      next(error);
    }
  };
