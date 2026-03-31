import type { Role } from "../lib/prisma-exports";

declare global {
  namespace Express {
    interface Request {
      user: {
        userId: string;
        role: Role;
        email: string;
      } | null;
    }
  }
}
