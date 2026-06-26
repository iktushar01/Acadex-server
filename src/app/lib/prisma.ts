import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "./prisma-exports";
import { envVars } from "../../config/env";

type PrismaClientInstance = InstanceType<typeof PrismaClient>;

const globalForPrisma = globalThis as {
  prisma?: PrismaClientInstance;
  pgPool?: Pool;
};

const pool =
  globalForPrisma.pgPool ??
  new Pool({
    connectionString: envVars.DATABASE_URL,
    max: process.env.VERCEL === "1" ? 2 : 10,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
  });

if (!globalForPrisma.pgPool) {
  globalForPrisma.pgPool = pool;
}

const adapter = new PrismaPg(pool);

const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma;
}

export { prisma };
