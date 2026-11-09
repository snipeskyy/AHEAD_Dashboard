import { db } from "@/lib/db";
import { audit } from "@/lib/db-extensions";
import { handler, json } from "@/lib/server/http";
import { teamDigest } from "@/lib/server/team-workspace";

/** The weekly team digest; ?format=md downloads it as Markdown (audited as an export). */
export const GET = handler(async (req: Request) => {
  const d = await teamDigest();
  if (new URL(req.url).searchParams.get("format") !== "md") return json(d);
  await audit(db, {
    action: "export.create",
    entityType: "export",
    entityId: "team-digest",
    summary: "Downloaded the weekly team digest (Markdown)",
  });
  return new Response(d.markdown, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="team-digest-${new Date().toISOString().slice(0, 10)}.md"`,
    },
  });
});
