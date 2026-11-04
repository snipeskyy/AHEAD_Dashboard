import { CommitBody } from "@/lib/import/schemas";
import { handler, json, readJson } from "@/lib/server/http";
import { commitImport } from "@/lib/server/import/commit";

export const POST = handler(async (req: Request) => {
  const body = CommitBody.parse(await readJson(req));
  const decisions = Object.fromEntries(
    Object.entries(body.decisions).map(([k, v]) => [Number(k), v]),
  );
  return json(await commitImport({ ...body, decisions }), { status: 201 });
});
