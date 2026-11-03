import { PrismaClient } from "@prisma/client";

/** Singleton Prisma client (survives Next dev hot reloads). */
const g = globalThis as unknown as { __accPrisma?: PrismaClient };

export const db: PrismaClient = g.__accPrisma ?? new PrismaClient({ log: ["warn", "error"] });
if (process.env.NODE_ENV !== "production") g.__accPrisma = db;
