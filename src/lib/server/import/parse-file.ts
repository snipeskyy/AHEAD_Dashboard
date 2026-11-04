import "server-only";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { HttpError } from "../http";

export const MAX_IMPORT_ROWS = 5000;
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

export interface ParsedTable {
  headers: string[];
  rows: Array<Record<string, string>>;
  truncated: boolean;
  sheet?: string;
}

/** Excel cell → display text (dates as YYYY-MM-DD; formulas use their cached result). */
function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("result" in v) return cellText(v.result as ExcelJS.CellValue);
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return String(v.text);
    if ("error" in v) return "";
  }
  return String(v).trim();
}

function finish(headers: string[], body: string[][], sheet?: string): ParsedTable {
  const clean = headers.map((h, i) => h.trim() || `Column ${i + 1}`);
  const uniq = clean.map((h, i) => (clean.indexOf(h) === i ? h : `${h} (${i + 1})`));
  const rows = body
    .filter((r) => r.some((c) => c.trim()))
    .map((r) => Object.fromEntries(uniq.map((h, i) => [h, (r[i] ?? "").trim()])));
  if (!uniq.length) throw new HttpError(400, "No header row found");
  return {
    headers: uniq,
    rows: rows.slice(0, MAX_IMPORT_ROWS),
    truncated: rows.length > MAX_IMPORT_ROWS,
    sheet,
  };
}

export async function parseXlsx(buf: ArrayBuffer): Promise<ParsedTable> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf);
  } catch {
    throw new HttpError(400, "Could not read this Excel file. Save it as .xlsx or CSV and retry.");
  }
  const ws = wb.worksheets.find((w) => w.actualRowCount > 0);
  if (!ws) throw new HttpError(400, "The workbook has no data");
  const grid: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as ExcelJS.CellValue[]; // 1-based
    grid.push(values.slice(1).map(cellText));
  });
  const [head = [], ...body] = grid;
  return finish(head, body, ws.name);
}

export function parseCsv(text: string): ParsedTable {
  const r = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: "greedy" });
  const [head = [], ...body] = r.data;
  return finish(head, body);
}

export async function parseUpload(
  file: File,
): Promise<ParsedTable & { inputType: "csv" | "xlsx" }> {
  if (file.size > MAX_IMPORT_BYTES) throw new HttpError(413, "File is larger than 10 MB");
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xlsm"))
    return { ...(await parseXlsx(await file.arrayBuffer())), inputType: "xlsx" };
  if (name.endsWith(".xls"))
    throw new HttpError(400, "Old .xls files aren't supported. Save as .xlsx or CSV.");
  return { ...parseCsv(await file.text()), inputType: "csv" };
}
