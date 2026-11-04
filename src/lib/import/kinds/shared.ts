import type { ImportField } from "../types";

/** Every child kind (contacts, opps, notes) references an existing account by name or domain. */
export const ACCOUNT_REF_FIELD: ImportField = {
  id: "account",
  label: "Account (name or domain)",
  required: true,
  aliases: [
    "account",
    "account name",
    "company",
    "company name",
    "organization",
    "domain",
    "account domain",
  ],
  example: "Example Holdings Inc.",
  hint: "Must match an account already in ACC (by domain or name).",
};
