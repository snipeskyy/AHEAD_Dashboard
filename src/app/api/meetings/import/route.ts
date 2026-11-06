import { handler, HttpError, json } from "@/lib/server/http";
import { importIcs } from "@/lib/server/meetings";

/** Upload an exported calendar file (.ics). Parsed locally; only titles, times, locations and attendee domains are kept. */
export const POST = handler(async (req: Request) => {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Attach an .ics file in the 'file' field");
  if (file.size > 5_000_000) throw new HttpError(413, "Calendar file is larger than 5 MB");
  return json(await importIcs(await file.text()), { status: 201 });
});
