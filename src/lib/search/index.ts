import "server-only";
import { db } from "@/lib/db";
import { createSqliteSearchProvider } from "./sqlite-provider";
import type { SearchProvider } from "./types";

const g = globalThis as unknown as { __accSearch?: SearchProvider };
export const search: SearchProvider = g.__accSearch ?? createSqliteSearchProvider(db);
g.__accSearch = search;
