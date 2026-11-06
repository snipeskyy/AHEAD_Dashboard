import { createManualBackup, listBackups, saveUploadedBackup } from "@/lib/server/backups";
import { HttpError, handler, json } from "@/lib/server/http";

/** Local backups in backups/ (newest first). */
export const GET = handler(async () => json({ items: await listBackups() }));

/** POST without a body: back up now. POST multipart with `file`: add an uploaded backup to the list. */
export const POST = handler(async (req: Request) => {
  if ((req.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
    const f = (await req.formData()).get("file");
    if (!(f instanceof File)) throw new HttpError(400, "Choose a backup file");
    if (f.size > 200 * 1024 * 1024) throw new HttpError(400, "Backup files are limited to 200 MB");
    return json({ file: await saveUploadedBackup(await f.text()) }, { status: 201 });
  }
  return json({ file: await createManualBackup() }, { status: 201 });
});
