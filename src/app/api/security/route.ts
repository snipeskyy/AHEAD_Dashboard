import { handler, json } from "@/lib/server/http";
import { securityChecklist } from "@/lib/server/security";

/** Security checklist (disk encryption, encrypted backups, localhost-only, API state, commit guard). */
export const GET = handler(async (req: Request) => json({ items: await securityChecklist(req) }));
