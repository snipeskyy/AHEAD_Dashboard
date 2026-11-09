import { handler, json } from "@/lib/server/http";
import { SANDBOX_TEMPLATES } from "@/modules/sandbox/lib/templates";

export const GET = handler(async () => json({ items: SANDBOX_TEMPLATES.map(({ id, name, description }) => ({ id, name, description })) }));
