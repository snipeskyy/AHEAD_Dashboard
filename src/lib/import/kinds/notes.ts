import type { ImportKindDef, RowIssue } from "../types";
import { cell, parseDate } from "../values";
import { ACCOUNT_REF_FIELD } from "./shared";

export interface NoteImportValue {
  account: string;
  body: string;
  date: Date | null;
}

export const notesKind: ImportKindDef<NoteImportValue> = {
  id: "notes",
  label: "Notes",
  singular: "note",
  description: "Your own notes, attached to accounts. Stored locally and marked internal.",
  fields: [
    ACCOUNT_REF_FIELD,
    {
      id: "body",
      label: "Note",
      required: true,
      aliases: ["note", "notes", "body", "text", "comment", "content"],
      example: "Met with the infrastructure team; consolidation is a 2027 priority.",
    },
    {
      id: "date",
      label: "Date",
      aliases: ["date", "created", "meeting date", "created at"],
      example: "2026-10-02",
    },
  ],
  normalize(r) {
    const errors: RowIssue[] = [];
    const account = cell(r.account);
    if (!account) errors.push({ field: "account", message: "Account is required" });
    const body = cell(r.body);
    if (body.length < 2 || body.length > 20_000)
      errors.push({ field: "body", message: "Note text is required (2–20,000 characters)" });
    const dateRaw = cell(r.date);
    const date = dateRaw ? parseDate(dateRaw) : null;
    if (dateRaw && !date) errors.push({ field: "date", message: `Invalid date "${dateRaw}"` });
    if (errors.length) return { ok: false, errors };
    return { ok: true, value: { account, body, date } };
  },
};
