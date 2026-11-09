import { handler, json } from "@/lib/server/http";
import { TCO_TEMPLATES } from "@/lib/tco/templates";

/** Starter structures (no prices). */
export const GET = handler(async () => json({ items: TCO_TEMPLATES.map(({ id, name, description }) => ({ id, name, description })) }));
