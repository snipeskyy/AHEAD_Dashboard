import type { ImportKindDef, RowIssue } from "../types";
import { cell, splitList } from "../values";

export interface PartnerRepImportValue {
  partnerCompany: string;
  name: string;
  title: string | null;
  territory: string | null;
  accounts: string[];
  notes: string | null;
}

export const partnerRepsKind: ImportKindDef<PartnerRepImportValue> = {
  id: "partner-reps",
  label: "Partner reps",
  singular: "partner rep",
  description:
    "Partner and OEM reps you co-sell with, entered by you, and the accounts they cover.",
  fields: [
    {
      id: "partnerCompany",
      label: "Partner company",
      required: true,
      aliases: ["partner", "partner company", "company", "vendor", "oem"],
      example: "Compute OEM A",
    },
    {
      id: "name",
      label: "Rep name",
      required: true,
      aliases: ["name", "rep", "rep name", "contact"],
      example: "Sam Rivera",
    },
    {
      id: "title",
      label: "Title",
      aliases: ["title", "role"],
      example: "Enterprise Account Manager",
    },
    {
      id: "territory",
      label: "Territory",
      aliases: ["territory", "region", "area"],
      example: "Central",
    },
    {
      id: "accounts",
      label: "Accounts covered",
      aliases: ["accounts", "accounts covered", "coverage", "customers"],
      example: "Example Holdings Inc.; example.org",
      hint: "Separate with ; (names or domains)",
    },
    { id: "notes", label: "Notes", aliases: ["notes", "comments"], example: "" },
  ],
  normalize(r) {
    const errors: RowIssue[] = [];
    const partnerCompany = cell(r.partnerCompany);
    if (partnerCompany.length < 2 || partnerCompany.length > 120)
      errors.push({ field: "partnerCompany", message: "Partner company is required" });
    const name = cell(r.name);
    if (name.length < 2 || name.length > 120)
      errors.push({ field: "name", message: "Rep name is required" });
    if (errors.length) return { ok: false, errors };
    return {
      ok: true,
      value: {
        partnerCompany,
        name,
        title: cell(r.title).slice(0, 120) || null,
        territory: cell(r.territory).slice(0, 120) || null,
        accounts: splitList(cell(r.accounts)).slice(0, 200),
        notes: cell(r.notes).slice(0, 4000) || null,
      },
    };
  },
};
