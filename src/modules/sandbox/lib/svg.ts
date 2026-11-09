import { rackLimitKw, type RoomCalc } from "./calc";
import type { SandboxSpec, SpecRack } from "./spec";
import type { ComponentLibrary, DeviceCategory } from "./types";

/**
 * Static SVG figures for exports (PDF, PPTX, Markdown). Print palette (always light); every label escaped,
 * so user-entered names can't inject markup.
 */
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
const P = {
  ink: "#121211",
  muted: "#5c5b57",
  grid: "#e4e3df",
  rack: "#3b3b3a",
  air: "#1baf7a",
  cdu: "#6250d6",
  crit: "#d63a3a",
};
const HEAT = ["#e9e8e2", "#a8c8ef", "#5c9be3", "#1f5fb0", "#d63a3a"];
const SERIES: Record<DeviceCategory, string> = {
  "gpu-server": "#2a78d6",
  "cpu-server": "#eb6834",
  storage: "#1baf7a",
  "tor-switch": "#eda100",
  "spine-switch": "#e87ba4",
  cdu: "#6250d6",
  pdu: "#e34948",
};
const T = 30;

export function floorPlanSvg(spec: SandboxSpec, calc: RoomCalc): string {
  const W = spec.room.widthTiles * T,
    H = spec.room.depthTiles * T;
  const byId = new Map(calc.racks.map((r) => [r.id, r]));
  const band = (kw: number, limit: number) => {
    const r = kw / Math.max(1, limit);
    return r === 0 ? 0 : r < 0.5 ? 1 : r < 0.85 ? 2 : r <= 1 ? 3 : 4;
  };
  const parts: string[] = [];
  for (let x = 0; x <= spec.room.widthTiles; x++)
    parts.push(`<line x1="${x * T}" y1="0" x2="${x * T}" y2="${H}" stroke="${P.grid}"/>`);
  for (let y = 0; y <= spec.room.depthTiles; y++)
    parts.push(`<line x1="0" y1="${y * T}" x2="${W}" y2="${y * T}" stroke="${P.grid}"/>`);
  for (const u of spec.coolingUnits) {
    const c = u.kind === "cdu" ? P.cdu : P.air;
    parts.push(
      `<rect x="${u.x * T + 1}" y="${u.y * T + 1}" width="${2 * T - 2}" height="${T - 2}" rx="3" fill="${c}" fill-opacity="0.2" stroke="${c}"/><text x="${u.x * T + T}" y="${u.y * T + T / 2 + 4}" font-size="10" text-anchor="middle" fill="${P.ink}">${esc(u.label)}</text>`,
    );
  }
  for (const r of spec.racks) {
    const c = byId.get(r.id);
    const crit = c?.issues.some((i) => i.severity === "critical");
    const front = r.rotation === 0 ? r.y * T + 2 * T - 4 : r.y * T + 4;
    parts.push(
      `<rect x="${r.x * T + 1}" y="${r.y * T + 1}" width="${T - 2}" height="${2 * T - 2}" rx="2" fill="${HEAT[band(c?.drawKw ?? 0, rackLimitKw(r, spec.assumptions.airKwPerRack))]}" stroke="${crit ? P.crit : P.ink}" stroke-width="${crit ? 2.5 : 1}"/>`,
      `<line x1="${r.x * T + 3}" x2="${r.x * T + T - 3}" y1="${front}" y2="${front}" stroke="${P.ink}" stroke-width="2"/>`,
      `<text font-size="9" fill="${P.ink}" text-anchor="middle" transform="translate(${r.x * T + T / 2 + 3},${r.y * T + T}) rotate(-90)">${esc(r.label)}</text>`,
    );
  }
  const legend = ["empty", "low", "medium", "high", "over limit"]
    .map(
      (l, i) =>
        `<rect x="${i * 88}" y="${H + 14}" width="12" height="12" fill="${HEAT[i]}" stroke="${P.muted}"/><text x="${i * 88 + 16}" y="${H + 24}" font-size="10" fill="${P.muted}">${l}</text>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W + 2} ${H + 34}" width="${W + 2}" height="${H + 34}" font-family="Helvetica, Arial, sans-serif"><rect x="0" y="0" width="${W}" height="${H}" fill="#fff" stroke="${P.ink}" stroke-width="2"/>${parts.join("")}${legend}</svg>`;
}

export function rackElevationSvg(r: SpecRack, lib: ComponentLibrary): string {
  const U = 9,
    w = 150,
    h = r.heightU * U;
  const devs = r.devices
    .map((d) => {
      const p = lib.get(d.profileId);
      if (!p || !p.heightU) return "";
      const y = (r.heightU - (d.position + p.heightU - 1)) * U + 18;
      const label =
        p.heightU * U >= 9
          ? `<text x="${w / 2 + 2}" y="${y + Math.min(p.heightU * U, 12) - 3}" font-size="7" text-anchor="middle" fill="${P.ink}">${esc(p.label.split(" (")[0])}</text>`
          : "";
      return `<rect x="8" y="${y + 0.5}" width="${w - 12}" height="${p.heightU * U - 1}" rx="1.5" fill="${SERIES[p.category]}" fill-opacity="0.55" stroke="${P.ink}" stroke-width="0.5"/>${label}`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w + 4} ${h + 22}" width="${w + 4}" height="${h + 22}" font-family="Helvetica, Arial, sans-serif"><text x="${w / 2 + 2}" y="11" font-size="10" font-weight="700" text-anchor="middle" fill="${P.ink}">${esc(r.label)}</text><rect x="2" y="17" width="${w}" height="${h + 2}" fill="#fff" stroke="${P.rack}"/>${devs}</svg>`;
}

/** Up to `n` rack elevations side by side in one figure (largest load first). */
export function rackRowSvg(
  spec: SandboxSpec,
  lib: ComponentLibrary,
  calc: RoomCalc,
  n = 6,
): string {
  const pick = [...spec.racks]
    .sort(
      (a, b) =>
        (calc.racks.find((x) => x.id === b.id)?.drawKw ?? 0) -
        (calc.racks.find((x) => x.id === a.id)?.drawKw ?? 0),
    )
    .slice(0, n);
  const items = pick.map((r) => rackElevationSvg(r, lib));
  const width = 160 * items.length,
    height = Math.max(...pick.map((r) => r.heightU * 9 + 22), 100);
  const inner = items
    .map(
      (s, i) =>
        `<g transform="translate(${i * 160},0)">${s.replace(/^<svg[^>]*>|<\/svg>$/g, "")}</g>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="Helvetica, Arial, sans-serif">${inner}</svg>`;
}
