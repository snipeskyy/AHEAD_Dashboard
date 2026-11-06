import { normalizeLegalName } from "@/lib/import/values";
import type { ProposalInput } from "../../types";

export interface PdbOrg {
  id: number;
  name: string;
  website?: string | null;
  city?: string | null;
  country?: string | null;
}
export interface PdbNet {
  id: number;
  name: string;
  asn: number;
  info_type?: string | null;
}
export interface PdbNetFac {
  net_id: number;
  fac_id: number;
  name: string;
  city?: string | null;
  country?: string | null;
}

/** Exact (normalized) org-name match only; a near match is not used. */
export const matchOrg = (orgs: PdbOrg[], name: string) => {
  const t = normalizeLegalName(name);
  const hits = orgs.filter((o) => normalizeLegalName(o.name) === t);
  return hits.length === 1 ? hits[0] : null;
};

export function normalizePeering(org: PdbOrg, nets: PdbNet[], fac: PdbNetFac[]): ProposalInput[] {
  if (!nets.length) return [];
  const facilities = [...new Map(fac.map((f) => [f.fac_id, f])).values()];
  return [
    {
      field: "network.peering",
      value: {
        asns: nets.map((n) => n.asn).slice(0, 20),
        networks: nets.length,
        facilities: facilities.length,
        facilityNames: facilities
          .slice(0, 12)
          .map((f) => [f.name, f.city].filter(Boolean).join(", ")),
        types: [...new Set(nets.map((n) => n.info_type).filter(Boolean))],
      },
      sourceUrl: `https://www.peeringdb.com/org/${org.id}`,
      confidence: "medium",
      evidenceSnippet: `${nets.length} network${nets.length === 1 ? "" : "s"} peering at ${facilities.length} facilities (PeeringDB)`,
    },
  ];
}
