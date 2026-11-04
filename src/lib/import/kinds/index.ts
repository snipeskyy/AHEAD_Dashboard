import type { ImportKind, ImportKindDef } from "../types";
import { accountsKind } from "./accounts";
import { contactsKind } from "./contacts";
import { notesKind } from "./notes";
import { opportunitiesKind } from "./opportunities";
import { partnerRepsKind } from "./partner-reps";

export const KIND_DEFS: Record<ImportKind, ImportKindDef> = {
  accounts: accountsKind as ImportKindDef,
  contacts: contactsKind as ImportKindDef,
  opportunities: opportunitiesKind as ImportKindDef,
  notes: notesKind as ImportKindDef,
  "partner-reps": partnerRepsKind as ImportKindDef,
};

export { accountsKind, contactsKind, notesKind, opportunitiesKind, partnerRepsKind };
