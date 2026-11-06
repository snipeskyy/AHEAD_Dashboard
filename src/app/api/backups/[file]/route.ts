import { readFile } from "node:fs/promises";
import { backupPath } from "@/lib/backup/auto";
import { previewBackup } from "@/lib/server/backups";
import { HttpError, handler, json } from "@/lib/server/http";

type Ctx = { params: Promise<{ file: string }> };

/** `?download=1` streams the file; otherwise returns its row counts for the restore preview. */
export const GET = handler(async (req: Request, { params }: Ctx) => {
  const { file } = await params;
  if (new URL(req.url).searchParams.get("download")) {
    const p = backupPath(file);
    if (!p) throw new HttpError(400, "Unknown backup file");
    return new Response(await readFile(p), { headers: { "content-type": "application/json", "content-disposition": `attachment; filename="${file}"` } });
  }
  return json(await previewBackup(file));
});
