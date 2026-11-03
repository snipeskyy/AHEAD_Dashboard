// Creates .env.local from .env.example on first install so Prisma + the worker have a DATABASE_URL.
import { copyFileSync, existsSync } from "node:fs";
if (!existsSync(".env.local") && existsSync(".env.example")) {
  copyFileSync(".env.example", ".env.local");
  console.log("[acc] Created .env.local from .env.example");
}
