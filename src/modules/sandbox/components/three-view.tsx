"use client";
import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { rackLimitKw, type RoomCalc } from "../lib/calc";
import { TILE_M, type SandboxSpec } from "../lib/spec";
import { heatBand } from "./floor-plan";

export type CameraPreset = "overview" | "aisle" | "rack";
/** Heat colors (sequential ramp, critical in red) — the same bands as the floor plan, with the legend in text. */
const HEAT = ["#d9d8d3", "#a8c8ef", "#5c9be3", "#1f5fb0", "#d63a3a"];
const RACK_H = 2.0; // m (42U)

function Rig({
  preset,
  target,
  aisleZ,
  size,
}: {
  preset: CameraPreset;
  target: THREE.Vector3;
  aisleZ: number;
  size: [number, number];
}) {
  const { camera } = useThree();
  const controls = useThree((st) => st.controls) as unknown as {
    target: THREE.Vector3;
    update: () => void;
  } | null;
  const goal = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3());
  const frames = useRef(0);
  useEffect(() => {
    const [w, d] = size;
    if (preset === "overview") goal.current.set(w * 0.5, Math.max(w, d) * 0.9, d * 1.25);
    else if (preset === "aisle") goal.current.set(-1.2, 1.6, aisleZ);
    else goal.current.set(target.x, 1.6, target.z + 3);
    look.current.copy(
      preset === "overview"
        ? new THREE.Vector3(w / 2, 0, d / 2)
        : preset === "aisle"
          ? new THREE.Vector3(w, 1.1, aisleZ)
          : target,
    );
    frames.current = 70; // animate briefly, then hand control back to orbit
  }, [preset, target, aisleZ, size]);
  useFrame(() => {
    if (frames.current <= 0) return;
    frames.current--;
    camera.position.lerp(goal.current, 0.1);
    if (controls) {
      controls.target.lerp(look.current, 0.1);
      controls.update();
    } else camera.lookAt(look.current);
  });
  return null;
}

/** 3D walkthrough: racks extruded from the floor plan, optional heat overlay, click a rack to select it. */
export function ThreeView({
  spec,
  calc,
  heat,
  preset,
  selectedId,
  onSelect,
  showLabels = true,
}: {
  spec: SandboxSpec;
  calc: RoomCalc;
  heat: boolean;
  preset: CameraPreset;
  selectedId: string | null;
  onSelect: (id: string) => void;
  showLabels?: boolean;
}) {
  const w = spec.room.widthTiles * TILE_M;
  const d = spec.room.depthTiles * TILE_M;
  const byId = useMemo(() => new Map(calc.racks.map((r) => [r.id, r])), [calc]);
  const sel = spec.racks.find((r) => r.id === selectedId) ?? spec.racks[0];
  // The cold aisle in front of the busiest row (racks sharing a y), 0.6 m beyond the rack fronts.
  const aisleZ = useMemo(() => {
    const rows = new Map<string, number>();
    for (const r of spec.racks)
      rows.set(`${r.y}:${r.rotation}`, (rows.get(`${r.y}:${r.rotation}`) ?? 0) + 1);
    const [key] = [...rows].sort((a, b) => b[1] - a[1])[0] ?? ["0:0"];
    const [y, rot] = key.split(":").map(Number);
    return rot === 0 ? (y + 2) * TILE_M + 0.6 : y * TILE_M - 0.6;
  }, [spec.racks]);
  const target = useMemo(
    () =>
      sel
        ? new THREE.Vector3(sel.x * TILE_M + 0.3, 1, sel.y * TILE_M + 0.6)
        : new THREE.Vector3(w / 2, 1, d / 2),
    [sel, w, d],
  );
  return (
    <div
      className="h-[520px] w-full overflow-hidden rounded-md border bg-[#f4f4f2] dark:bg-[#151514]"
      role="img"
      aria-label={`3D view of ${spec.room.label}: ${spec.racks.length} racks and ${spec.coolingUnits.length} cooling units. Drag to orbit, scroll to zoom, click a rack to select it.`}
    >
      <Canvas
        shadows
        camera={{ position: [w * 0.5, Math.max(w, d), d * 1.3], fov: 45 }}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[w, 8, d]} intensity={0.9} castShadow />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[w / 2, 0, d / 2]} receiveShadow>
          <planeGeometry args={[w, d]} />
          <meshStandardMaterial color="#e7e6e1" />
        </mesh>
        <gridHelper
          args={[Math.max(w, d), Math.round(Math.max(w, d) / TILE_M), "#b9b8b1", "#cfcec8"]}
          position={[w / 2, 0.002, d / 2]}
        />
        {spec.racks.map((r) => {
          const c = byId.get(r.id);
          const band = heatBand(c?.drawKw ?? 0, rackLimitKw(r, spec.assumptions.airKwPerRack));
          const isSel = r.id === selectedId;
          const h = (r.heightU / 42) * RACK_H;
          return (
            <group key={r.id} position={[r.x * TILE_M + 0.3, h / 2, r.y * TILE_M + 0.6]}>
              <mesh
                castShadow
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(r.id);
                }}
              >
                <boxGeometry args={[0.58, h, 1.18]} />
                <meshStandardMaterial
                  color={heat ? HEAT[band.i] : "#3b3b3a"}
                  emissive={isSel ? "#2a78d6" : "#000000"}
                  emissiveIntensity={isSel ? 0.35 : 0}
                  roughness={0.6}
                />
              </mesh>
              {/* front door marker on the cold-aisle side */}
              <mesh position={[0, 0, r.rotation === 0 ? 0.6 : -0.6]}>
                <boxGeometry args={[0.5, h * 0.92, 0.01]} />
                <meshStandardMaterial color="#9aa4b2" metalness={0.4} roughness={0.4} />
              </mesh>
              {showLabels && (
                <Html
                  position={[0, h / 2 + 0.15, 0]}
                  center
                  distanceFactor={5}
                  zIndexRange={[10, 0]}
                >
                  <span className="rounded bg-white/85 px-1 text-[10px] font-medium whitespace-nowrap text-black shadow-sm">
                    {r.label}
                    {heat ? ` · ${(c?.drawKw ?? 0).toFixed(1)} kW` : ""}
                  </span>
                </Html>
              )}
            </group>
          );
        })}
        {spec.coolingUnits.map((u) => (
          <mesh key={u.id} position={[u.x * TILE_M + 0.6, 0.9, u.y * TILE_M + 0.3]} castShadow>
            <boxGeometry args={[1.18, 1.8, 0.58]} />
            <meshStandardMaterial
              color={u.kind === "cdu" ? "#6250d6" : "#1baf7a"}
              roughness={0.5}
            />
          </mesh>
        ))}
        <OrbitControls
          makeDefault
          enableDamping
          target={[w / 2, 0, d / 2]}
          maxPolarAngle={Math.PI / 2.05}
        />
        <Rig preset={preset} target={target} aisleZ={aisleZ} size={[w, d]} />
      </Canvas>
    </div>
  );
}

export const HEAT_COLORS = HEAT;
