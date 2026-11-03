import { createLibrary } from "../lib/library";
import type { DeviceCategory } from "../lib/types";

const lib = createLibrary();

/** Category → fixed categorical series slot (color follows the entity). */
export const CATEGORY_STYLE: Record<DeviceCategory, { series: number; label: string }> = {
  "gpu-server": { series: 1, label: "GPU server" },
  "cpu-server": { series: 2, label: "CPU server" },
  storage: { series: 3, label: "Storage" },
  "tor-switch": { series: 4, label: "ToR switch" },
  "spine-switch": { series: 5, label: "Spine switch" },
  cdu: { series: 7, label: "CDU" },
  pdu: { series: 8, label: "PDU" },
};

const U = 13; // px per rack unit
const W = 230;

/** Static 2D rack elevation (front view). Pure SVG; theme-aware via CSS tokens. */
export function RackElevation({
  label,
  heightU,
  devices,
}: {
  label: string;
  heightU: number;
  devices: Array<{ profileId: string; position: number }>;
}) {
  const h = heightU * U;
  const padX = 26;
  return (
    <figure className="grid justify-items-center gap-2">
      <svg
        viewBox={`0 0 ${W + padX * 2} ${h + 24}`}
        className="h-auto w-full max-w-[290px]"
        role="img"
        aria-label={`${label}: ${devices.length} devices in a ${heightU}U rack`}
      >
        <rect
          x={padX - 8}
          y={4}
          width={W + 16}
          height={h + 16}
          rx={6}
          fill="var(--muted)"
          stroke="var(--border)"
        />
        {Array.from({ length: heightU }, (_, i) => {
          const u = heightU - i;
          return (
            <g key={u}>
              <line
                x1={padX}
                x2={padX + W}
                y1={12 + i * U}
                y2={12 + i * U}
                stroke="var(--border)"
                strokeWidth={0.5}
              />
              {u % 5 === 0 || u === 1 ? (
                <text
                  x={padX - 12}
                  y={12 + i * U + U - 3}
                  fontSize={8}
                  textAnchor="end"
                  fill="var(--muted-foreground)"
                  className="tabular"
                >
                  {u}
                </text>
              ) : null}
            </g>
          );
        })}
        {devices.map((d, i) => {
          const prof = lib.get(d.profileId);
          if (!prof || prof.heightU === 0) return null;
          const top = 12 + (heightU - (d.position + prof.heightU - 1)) * U;
          const style = CATEGORY_STYLE[prof.category];
          return (
            <g key={i}>
              <title>{`${prof.label} · U${d.position}${prof.heightU > 1 ? `–${d.position + prof.heightU - 1}` : ""} · ~${prof.typicalKw} kW typical`}</title>
              <rect
                x={padX + 1}
                y={top + 1}
                width={W - 2}
                height={prof.heightU * U - 2}
                rx={2}
                fill={`var(--series-${style.series})`}
                fillOpacity={0.22}
                stroke={`var(--series-${style.series})`}
                strokeWidth={1}
              />
              <rect
                x={padX + 1}
                y={top + 1}
                width={4}
                height={prof.heightU * U - 2}
                fill={`var(--series-${style.series})`}
              />
              {prof.heightU * U >= 12 && (
                <text
                  x={padX + 12}
                  y={top + Math.min(prof.heightU * U, 26) / 2 + 4}
                  fontSize={9}
                  fill="var(--foreground)"
                >
                  {style.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="text-xs font-medium">{label}</figcaption>
    </figure>
  );
}
