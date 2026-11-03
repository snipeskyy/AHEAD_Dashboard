import type { PrismaClient } from "@prisma/client";
import type { Block } from "./types";

export interface BuildAccount {
  id: string;
  name: string;
  tier: string;
  industry: string;
  isDemo: boolean;
}

export interface BuildContext {
  db: PrismaClient;
  scope: "account" | "accounts" | "portfolio";
  /** Resolved accounts in scope (for "portfolio", every account). */
  accounts: BuildAccount[];
  now: Date;
  audience: "internal" | "customer";
}

/** Builds the blocks for one export section. Tag blocks/items/columns with `field` for redaction. */
export type SectionBuilder = (ctx: BuildContext) => Promise<Block[]>;
export type SectionBuilders = Record<string, SectionBuilder>;
