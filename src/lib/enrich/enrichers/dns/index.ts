import type { Enricher } from "../../types";
import { normalizeDns, type DnsAnswer } from "./normalize";

type DohResponse = { Status: number; Answer?: DnsAnswer[] };

/** Public DNS (DNS-over-HTTPS, dns.google): email platform, SPF senders and SaaS domain verifications. */
const dns: Enricher = {
  id: "dns",
  label: "DNS footprint",
  source: "Public DNS",
  description:
    "MX, SPF and domain-verification records: email platform and SaaS services verified on the domain. All labeled as hypotheses.",
  requires: ["domain"],
  produces: ["tech:*"],
  ttlDays: 30,
  defaultEnabled: true,
  async run(id, ctx) {
    const q = (type: "MX" | "TXT") =>
      ctx.http.json<DohResponse>(
        `https://dns.google/resolve?name=${encodeURIComponent(id.domain!)}&type=${type}`,
        { ttlMs: 86_400_000 },
      );
    const [mx, txt] = [await q("MX"), await q("TXT")];
    return { proposals: normalizeDns(id.domain!, mx.Answer ?? [], txt.Answer ?? []) };
  },
};
export default dns;
