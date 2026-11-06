import { PrismaClient } from "@prisma/client";
import { withTeamFoundations } from "./db-extensions";

/** Singleton Prisma client (survives Next dev hot reloads), with ownership stamping + delete auditing (Phase 8). */
const g = globalThis as unknown as { __accPrisma?: PrismaClient };

export const db: PrismaClient = g.__accPrisma ?? withTeamFoundations(new PrismaClient({ log: ["warn", "error"] }));
if (process.env.NODE_ENV !== "production") g.__accPrisma = db;
