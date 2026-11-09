import { CreateScenarioBody, createScenario, listScenarios } from "@/lib/server/sandbox";
import { handler, json, readJson } from "@/lib/server/http";

export const GET = handler(async (req: Request) => json({ items: await listScenarios(new URL(req.url).searchParams.get("accountId")) }));

export const POST = handler(async (req: Request) => json(await createScenario(CreateScenarioBody.parse(await readJson(req))), { status: 201 }));
