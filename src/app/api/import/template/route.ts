import ExcelJS from "exceljs";
import { KIND_DEFS } from "@/lib/import/kinds";
import { templateCsv } from "@/lib/import/mapping";
import { KindSchema } from "@/lib/import/schemas";
import { handler } from "@/lib/server/http";

/** Downloadable import template (header row + one fictional example row). */
export const GET = handler(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const def = KIND_DEFS[KindSchema.parse(q.get("kind"))];
  const name = `acc-import-${def.id}`;
  if (q.get("format") === "xlsx") {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(def.label);
    ws.addRow(def.fields.map((f) => f.label)).font = { bold: true };
    ws.addRow(def.fields.map((f) => f.example));
    ws.columns.forEach((c) => (c.width = 24));
    const help = wb.addWorksheet("Field notes");
    help.addRow(["Column", "Required", "Notes"]).font = { bold: true };
    for (const f of def.fields) help.addRow([f.label, f.required ? "yes" : "", f.hint ?? ""]);
    help.columns.forEach((c) => (c.width = 40));
    const buf = await wb.xlsx.writeBuffer();
    return new Response(buf as ArrayBuffer, {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${name}.xlsx"`,
      },
    });
  }
  return new Response(templateCsv(def.fields), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}.csv"`,
    },
  });
});
