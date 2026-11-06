import { db } from "@/lib/db";
import { handler, json, readJson } from "@/lib/server/http";
import { RegistrationBody } from "@/lib/server/partners";

/** Deal registrations with partners (user-entered). */
export const POST = handler(async (req: Request) =>
  json(await db.partnerRegistration.create({ data: RegistrationBody.parse(await readJson(req)) }), { status: 201 }),
);
