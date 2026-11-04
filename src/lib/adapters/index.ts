import { crmPlaceholderAdapter } from "./sources/crm-placeholder";
import { gdeltAdapter } from "./sources/gdelt";
import { googleNewsAdapter } from "./sources/google-news";
import { greenhouseAdapter } from "./sources/greenhouse";
import { leverAdapter } from "./sources/lever";
import { rssNewsAdapter } from "./sources/rss-news";
import { secEdgarAdapter } from "./sources/sec-edgar";
import type { DataAdapter, NormalizedSignal } from "./types";

/** Signal adapters contributed by the Live Signals module (see src/modules/signals/module.ts). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous Raw types; each adapter is typed at its definition
export const SIGNAL_ADAPTERS: DataAdapter<NormalizedSignal, any>[] = [
  googleNewsAdapter,
  rssNewsAdapter,
  secEdgarAdapter,
  greenhouseAdapter,
  leverAdapter,
  gdeltAdapter,
  crmPlaceholderAdapter,
];
