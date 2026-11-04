import { handler, HttpError, json } from "@/lib/server/http";
import { parseUpload } from "@/lib/server/import/parse-file";

/** CSV / XLSX upload → { headers, rows }. Parsed locally; the file is not stored. */
export const POST = handler(async (req: Request) => {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Attach a file in the 'file' field");
  const t = await parseUpload(file);
  return json({ ...t, fileName: file.name });
});
