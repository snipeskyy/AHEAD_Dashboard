import type { Enricher } from "../../types";
import { matchOrg, normalizePeering, type PdbNet, type PdbNetFac, type PdbOrg } from "./normalize";

type Page<T> = { data: T[] };

/** PeeringDB (optional): networks (ASNs) and the data center facilities where the organization peers. */
const peeringdb: Enricher = {
  id: "peeringdb",
  label: "PeeringDB network presence",
  source: "PeeringDB",
  description:
    "Optional. Networks (ASNs) and peering facilities for the organization. Useful context for data center conversations.",
  requires: [],
  produces: ["network.peering"],
  ttlDays: 30,
  defaultEnabled: false,
  optional: true,
  async run(id, ctx) {
    const base = "https://www.peeringdb.com/api";
    const orgs = (
      await ctx.http.json<Page<PdbOrg>>(
        `${base}/org?name__contains=${encodeURIComponent(id.name)}&limit=20`,
        { ttlMs: 30 * 86_400_000 },
      )
    ).data;
    const org = matchOrg(orgs, id.legalName ?? id.name) ?? matchOrg(orgs, id.name);
    if (!org) return { proposals: [] };
    const nets = (
      await ctx.http.json<Page<PdbNet>>(`${base}/net?org_id=${org.id}`, { ttlMs: 30 * 86_400_000 })
    ).data;
    const fac = nets.length
      ? (
          await ctx.http.json<Page<PdbNetFac>>(
            `${base}/netfac?net_id__in=${nets
              .slice(0, 20)
              .map((n) => n.id)
              .join(",")}`,
            { ttlMs: 30 * 86_400_000 },
          )
        ).data
      : [];
    return { proposals: normalizePeering(org, nets, fac) };
  },
};
export default peeringdb;
