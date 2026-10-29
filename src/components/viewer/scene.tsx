"use client";

import { Suspense, useEffect, useMemo, useRef, Component, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Sky, Stars, Edges, ContactShadows, useGLTF, Grid } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useViewerStore } from "@/stores/viewer-store";
import {
  PODIUM_HEIGHT,
  floorY,
  placeUnit,
  priceRange,
  towerHeight,
  unitColor,
  type TowerGeom,
  type UnitGeom,
} from "./layout";
import { LabelOverlay, LabelProjector, type SceneLabel } from "./labels";

type Extent = { minX: number; maxX: number; minZ: number; maxZ: number };

function computeExtent(towers: TowerGeom[]): Extent {
  const xs = towers.map((t) => t.positionX);
  const zs = towers.map((t) => t.positionZ);
  return {
    minX: Math.min(...xs, 0) - 45,
    maxX: Math.max(...xs, 0) + 45,
    minZ: Math.min(...zs, 0) - 40,
    maxZ: Math.max(...zs, 0) + 55,
  };
}

export type SceneProps = {
  towers: TowerGeom[];
  units: UnitGeom[];
  siteModelUrl?: string | null;
  interactive?: boolean;
  className?: string;
  onSelect?: (unitId: string | null) => void;
};

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------
export function ProjectScene({ towers, units, siteModelUrl, interactive = true, className, onSelect }: SceneProps) {
  const select = useViewerStore((s) => s.select);
  const autoRotate = useViewerStore((s) => s.autoRotate);
  const unitsByTower = useMemo(() => {
    const m = new Map<string, UnitGeom[]>();
    for (const u of units) {
      const arr = m.get(u.towerId) ?? [];
      arr.push(u);
      m.set(u.towerId, arr);
    }
    return m;
  }, [units]);
  const range = useMemo(() => priceRange(units), [units]);

  // La torre focal es la primera con inventario (o la primera en venta).
  const focal = useMemo(() => {
    const withUnits = towers.find((t) => (unitsByTower.get(t.id)?.length ?? 0) > 0);
    return withUnits ?? towers.find((t) => t.releaseStatus === "EN_VENTA") ?? towers[0];
  }, [towers, unitsByTower]);

  const center = useMemo(() => {
    if (!focal) return new THREE.Vector3(0, 20, 0);
    return new THREE.Vector3(focal.positionX, towerHeight(focal) * 0.42, focal.positionZ);
  }, [focal]);

  const initialCamera = useMemo<[number, number, number]>(() => {
    if (!focal) return [95, 70, 110];
    // Se ubica del lado opuesto al resto de torres para que la focal quede al frente.
    const others = towers.filter((t) => t.id !== focal.id);
    const dx = others.length ? Math.sign(focal.positionX - others.reduce((a, t) => a + t.positionX, 0) / others.length) || -1 : -1;
    const dz = others.length ? Math.sign(focal.positionZ - others.reduce((a, t) => a + t.positionZ, 0) / others.length) || -1 : 1;
    const h = towerHeight(focal);
    return [focal.positionX + dx * 90, h * 0.95, focal.positionZ + dz * 150];
  }, [focal, towers]);

  const floorCut = useViewerStore((s) => s.floorCut);
  const showLabels = useViewerStore((s) => s.showLabels);
  const siteExtent = useMemo(() => computeExtent(towers), [towers]);

  const labels = useMemo<SceneLabel[]>(() => {
    const list: SceneLabel[] = [];
    for (const t of towers) {
      const hasInventory = (unitsByTower.get(t.id)?.length ?? 0) > 0;
      const h = towerHeight(t);
      const topY = floorCut && hasInventory ? floorY(t, floorCut + 1) : h;
      list.push({
        id: `tower-${t.id}`,
        position: [t.positionX, topY + 4, t.positionZ],
        hidden: !showLabels,
        refDistance: 170,
        content: (
          <div className="flex flex-col items-center">
            <span className="rounded-md bg-black/70 px-2 py-1 text-xs font-semibold text-white">{t.code}</span>
            <span className="mt-0.5 whitespace-nowrap rounded bg-black/50 px-1.5 text-[10px] text-white/80">
              {hasInventory ? `${t.floors} pisos · ${t.unitsPerFloor} aptos/piso` : "Próximamente"}
            </span>
          </div>
        ),
      });
      if (hasInventory) {
        list.push({
          id: `cut-${t.id}`,
          position: [t.positionX + t.footprintWidth / 2 + 3, floorY(t, floorCut ?? t.firstResidentialFloor) + t.floorHeight, t.positionZ],
          hidden: !floorCut,
          refDistance: 120,
          content: <span className="rounded bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">Piso {floorCut}</span>,
        });
      }
    }
    list.push({
      id: "mall",
      position: [siteExtent.minX + 16, 6.2, siteExtent.minZ + 12],
      hidden: !showLabels,
      content: <span className="whitespace-nowrap rounded bg-black/60 px-2 py-0.5 text-[10px] text-white">Mall · 750 m²</span>,
    });
    list.push({
      id: "amenities",
      position: [siteExtent.maxX - 14, 16, siteExtent.minZ + 14],
      hidden: !showLabels,
      content: <span className="whitespace-nowrap rounded bg-black/60 px-2 py-0.5 text-[10px] text-white">Amenidades · Piscina · Parqueadero</span>,
    });
    return list;
  }, [towers, unitsByTower, floorCut, showLabels, siteExtent]);

  return (
    <div className={`relative ${className ?? ""}`}>
      <LabelOverlay labels={labels} />
      <Canvas
        shadows={{ type: THREE.PCFShadowMap }}
        dpr={[1, 1.75]}
        camera={{ position: initialCamera, fov: 42, near: 0.5, far: 3000 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95 }}
        onPointerMissed={() => {
          if (!interactive) return;
          select(null);
          onSelect?.(null);
        }}
      >
        <LabelProjector labels={labels} />
        <SunAndSky />
        <Ground extent={siteExtent} />
        <Suspense fallback={null}>
          {siteModelUrl ? (
            <GLBErrorBoundary
              fallback={<ParametricSite towers={towers} unitsByTower={unitsByTower} range={range} interactive={interactive} onSelect={onSelect} />}
            >
              <GLBSite url={siteModelUrl} units={units} range={range} interactive={interactive} onSelect={onSelect} />
            </GLBErrorBoundary>
          ) : (
            <ParametricSite towers={towers} unitsByTower={unitsByTower} range={range} interactive={interactive} onSelect={onSelect} />
          )}
        </Suspense>
        <Context />
        <CameraRig towers={towers} units={units} center={center} />
        <OrbitControls
          makeDefault
          target={center}
          maxPolarAngle={Math.PI / 2 - 0.02}
          minDistance={15}
          maxDistance={420}
          enableDamping
          dampingFactor={0.08}
          autoRotate={autoRotate}
          autoRotateSpeed={0.6}
        />
      </Canvas>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cielo y sol según hora del día
// ---------------------------------------------------------------------------
function SunAndSky() {
  const t = useViewerStore((s) => s.timeOfDay);
  const sun = useMemo(() => {
    const theta = ((t - 6) / 12) * Math.PI; // 6h => amanecer, 18h => atardecer
    const elev = Math.sin(theta);
    const r = 400;
    return new THREE.Vector3(Math.cos(theta) * r, Math.max(elev, -0.15) * r, -r * 0.35);
  }, [t]);
  const isNight = t < 5.5 || t > 18.5;
  const dusk = Math.min(1, Math.max(0, 1 - Math.abs(sun.y) / 120));
  const intensity = isNight ? 0.08 : 0.9 + 1.4 * Math.min(1, sun.y / 300);

  return (
    <>
      <Sky distance={4500} sunPosition={sun.toArray()} turbidity={isNight ? 1 : 6 + dusk * 6} rayleigh={isNight ? 0.2 : 1.5 + dusk * 2} mieCoefficient={0.004} mieDirectionalG={0.85} />
      {isNight && <Stars radius={900} depth={60} count={2500} factor={3} fade speed={0.3} />}
      <ambientLight intensity={isNight ? 0.25 : 0.35} color={isNight ? "#8fa9ff" : "#ffffff"} />
      <hemisphereLight intensity={isNight ? 0.15 : 0.5} color="#dbe7ff" groundColor="#3a3a2a" />
      <directionalLight
        position={sun.toArray()}
        intensity={intensity}
        color={dusk > 0.4 ? "#ffb070" : "#fff6e5"}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-150}
        shadow-camera-right={150}
        shadow-camera-top={150}
        shadow-camera-bottom={-150}
        shadow-camera-near={10}
        shadow-camera-far={1200}
        shadow-bias={-0.0005}
      />
      <fog attach="fog" args={[isNight ? "#0a1020" : "#dfe8f3", 250, 1400]} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Terreno, urbanismo y mall
// ---------------------------------------------------------------------------
function Ground({ extent }: { extent: Extent }) {
  const t = useViewerStore((s) => s.timeOfDay);
  const isNight = t < 5.5 || t > 18.5;
  const w = extent.maxX - extent.minX;
  const d = extent.maxZ - extent.minZ;
  const cx = (extent.minX + extent.maxX) / 2;
  const cz = (extent.minZ + extent.maxZ) / 2;

  return (
    <group>
      {/* Terreno general */}
      <mesh rotation-x={-Math.PI / 2} position={[cx, -0.05, cz]} receiveShadow>
        <planeGeometry args={[2400, 2400]} />
        <meshStandardMaterial color={isNight ? "#141a16" : "#6f8a5a"} roughness={1} />
      </mesh>
      {/* Lote */}
      <mesh rotation-x={-Math.PI / 2} position={[cx, 0, cz]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={isNight ? "#23282c" : "#b9bcb4"} roughness={0.95} />
      </mesh>
      <Grid position={[cx, 0.01, cz]} args={[w, d]} cellSize={4} cellThickness={0.4} sectionSize={16} sectionThickness={0.8} cellColor="#9aa3ad" sectionColor="#7d8791" fadeDistance={260} infiniteGrid={false} />
      {/* Parque lineal (franja verde al frente) */}
      <mesh rotation-x={-Math.PI / 2} position={[cx, 0.02, extent.maxZ - 6]} receiveShadow>
        <planeGeometry args={[w, 10]} />
        <meshStandardMaterial color={isNight ? "#1b2a1c" : "#5f9a4f"} roughness={1} />
      </mesh>
      {Array.from({ length: Math.floor(w / 9) }).map((_, i) => (
        <Tree key={i} position={[extent.minX + 5 + i * 9, 0, extent.maxZ - 6 + (i % 2 ? 2.2 : -2.2)]} night={isNight} />
      ))}
      {/* Mall de conveniencia */}
      <mesh position={[extent.minX + 16, 2.2, extent.minZ + 12]} castShadow receiveShadow>
        <boxGeometry args={[30, 4.4, 20]} />
        <meshStandardMaterial color={isNight ? "#2b3140" : "#d9d4c7"} roughness={0.7} />
      </mesh>
      {/* Torre de amenidades y parqueadero */}
      <mesh position={[extent.maxX - 14, 7, extent.minZ + 14]} castShadow receiveShadow>
        <boxGeometry args={[22, 14, 22]} />
        <meshStandardMaterial color={isNight ? "#2b3140" : "#cfd3d8"} roughness={0.75} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[extent.maxX - 14, 14.05, extent.minZ + 14]}>
        <planeGeometry args={[12, 6]} />
        <meshStandardMaterial color="#2aa7d8" emissive="#1b7ea6" emissiveIntensity={isNight ? 0.8 : 0.1} />
      </mesh>
      <ContactShadows position={[cx, 0.03, cz]} opacity={0.5} scale={Math.max(w, d) * 1.4} blur={2.5} far={40} />
    </group>
  );
}

function Tree({ position, night }: { position: [number, number, number]; night: boolean }) {
  return (
    <group position={position}>
      <mesh position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.25, 2.4, 6]} />
        <meshStandardMaterial color="#5a4632" />
      </mesh>
      <mesh position={[0, 3.3, 0]} castShadow>
        <sphereGeometry args={[1.6, 10, 8]} />
        <meshStandardMaterial color={night ? "#1f3a24" : "#3f7f3a"} roughness={1} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Contexto: cerro y edificaciones lejanas para la "vista desde el piso"
// ---------------------------------------------------------------------------
function Context() {
  const t = useViewerStore((s) => s.timeOfDay);
  const isNight = t < 5.5 || t > 18.5;
  const blocks = useMemo(() => {
    const arr: { p: [number, number, number]; s: [number, number, number] }[] = [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 90; i++) {
      const ang = rnd() * Math.PI * 2;
      const r = 170 + rnd() * 420;
      const h = 6 + rnd() * 26;
      arr.push({ p: [Math.cos(ang) * r, h / 2, Math.sin(ang) * r], s: [10 + rnd() * 18, h, 10 + rnd() * 18] });
    }
    return arr;
  }, []);
  return (
    <group>
      {/* Cerro Quitasol al norte */}
      <mesh position={[-120, 0, -820]}>
        <coneGeometry args={[520, 300, 7]} />
        <meshStandardMaterial color={isNight ? "#0f1a14" : "#3e6b45"} flatShading roughness={1} />
      </mesh>
      <mesh position={[360, 0, -700]}>
        <coneGeometry args={[320, 180, 6]} />
        <meshStandardMaterial color={isNight ? "#10181a" : "#4d7a52"} flatShading roughness={1} />
      </mesh>
      {/* Copacabana al sur-oriente */}
      <mesh position={[520, 0, 640]}>
        <coneGeometry args={[380, 170, 6]} />
        <meshStandardMaterial color={isNight ? "#10181a" : "#557c55"} flatShading roughness={1} />
      </mesh>
      {blocks.map((b, i) => (
        <mesh key={i} position={b.p} receiveShadow>
          <boxGeometry args={b.s} />
          <meshStandardMaterial color={isNight ? "#1e2430" : "#c9c4b8"} emissive={isNight ? "#f7c873" : "#000"} emissiveIntensity={isNight ? 0.12 : 0} roughness={0.9} />
        </mesh>
      ))}
      {/* Río Medellín / Autopista Norte: franja al occidente */}
      <mesh rotation-x={-Math.PI / 2} position={[-230, 0.05, 0]}>
        <planeGeometry args={[28, 1800]} />
        <meshStandardMaterial color={isNight ? "#1a2735" : "#5e8fb3"} roughness={0.3} metalness={0.2} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[-190, 0.06, 0]}>
        <planeGeometry args={[16, 1800]} />
        <meshStandardMaterial color={isNight ? "#2a2a2a" : "#4a4a4a"} roughness={1} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Modo paramétrico
// ---------------------------------------------------------------------------
function ParametricSite({
  towers,
  unitsByTower,
  range,
  interactive,
  onSelect,
}: {
  towers: TowerGeom[];
  unitsByTower: Map<string, UnitGeom[]>;
  range: [number, number];
  interactive: boolean;
  onSelect?: (id: string | null) => void;
}) {
  return (
    <group>
      {towers.map((t) => (
        <ParametricTower key={t.id} tower={t} units={unitsByTower.get(t.id) ?? []} range={range} interactive={interactive} onSelect={onSelect} />
      ))}
    </group>
  );
}

function ParametricTower({
  tower,
  units,
  range,
  interactive,
  onSelect,
}: {
  tower: TowerGeom;
  units: UnitGeom[];
  range: [number, number];
  interactive: boolean;
  onSelect?: (id: string | null) => void;
}) {
  const floorCut = useViewerStore((s) => s.floorCut);
  const t = useViewerStore((s) => s.timeOfDay);
  const isNight = t < 5.5 || t > 18.5;
  const h = towerHeight(tower);
  const hasInventory = units.length > 0;
  const visibleH = floorCut && hasInventory ? floorY(tower, floorCut + 1) : h;

  return (
    <group position={[tower.positionX, 0, tower.positionZ]} rotation-y={tower.rotationY}>
      {/* Podio */}
      <mesh position={[0, PODIUM_HEIGHT / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[tower.footprintWidth + 2, PODIUM_HEIGHT, tower.footprintDepth + 2]} />
        <meshStandardMaterial color={isNight ? "#262c36" : "#9aa0a8"} roughness={0.8} />
      </mesh>
      {/* Núcleo (corredor, ascensores) */}
      <mesh position={[0, PODIUM_HEIGHT + (visibleH - PODIUM_HEIGHT) / 2, 0]} castShadow>
        <boxGeometry args={[tower.footprintWidth * 0.98, visibleH - PODIUM_HEIGHT, 1.6]} />
        <meshStandardMaterial color={isNight ? "#1b2029" : "#6b7280"} roughness={0.9} />
      </mesh>
      {/* Cubierta */}
      {!floorCut && (
        <mesh position={[0, h + 0.25, 0]} castShadow>
          <boxGeometry args={[tower.footprintWidth + 0.6, 0.5, tower.footprintDepth + 0.6]} />
          <meshStandardMaterial color={isNight ? "#2a3140" : "#e5e7eb"} roughness={0.6} />
        </mesh>
      )}

      {hasInventory ? (
        units.map((u) => (
          <UnitBox key={u.id} unit={u} tower={tower} range={range} interactive={interactive} onSelect={onSelect} />
        ))
      ) : (
        // Torre sin inventario (Próximamente): volumen translúcido tipo maqueta
        <mesh position={[0, PODIUM_HEIGHT + (h - PODIUM_HEIGHT) / 2, 0]}>
          <boxGeometry args={[tower.footprintWidth, h - PODIUM_HEIGHT, tower.footprintDepth]} />
          <meshStandardMaterial color={isNight ? "#3b4a63" : "#e2e8f0"} transparent opacity={0.22} roughness={0.3} depthWrite={false} />
          <Edges color="#94a3b8" threshold={15} />
        </mesh>
      )}

      {/* Plano de corte: losa visible sobre el piso cortado */}
      {floorCut && hasInventory && (
        <mesh position={[0, visibleH + 0.05, 0]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[tower.footprintWidth + 0.4, tower.footprintDepth + 0.4]} />
          <meshStandardMaterial color="#e0b45a" emissive="#e0b45a" emissiveIntensity={0.25} transparent opacity={0.35} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

function UnitBox({
  unit,
  tower,
  range,
  interactive,
  onSelect,
}: {
  unit: UnitGeom;
  tower: TowerGeom;
  range: [number, number];
  interactive: boolean;
  onSelect?: (id: string | null) => void;
}) {
  const selectedId = useViewerStore((s) => s.selectedUnitId);
  const hoveredId = useViewerStore((s) => s.hoveredUnitId);
  const compareIds = useViewerStore((s) => s.compareIds);
  const colorMode = useViewerStore((s) => s.colorMode);
  const floorCut = useViewerStore((s) => s.floorCut);
  const filterTypology = useViewerStore((s) => s.filterTypology);
  const filterStatus = useViewerStore((s) => s.filterStatus);
  const t = useViewerStore((s) => s.timeOfDay);
  const select = useViewerStore((s) => s.select);
  const hover = useViewerStore((s) => s.hover);

  const { position, size } = useMemo(() => placeUnit(tower, unit.floor, unit.position), [tower, unit.floor, unit.position]);
  const isSelected = selectedId === unit.id;
  const isHovered = hoveredId === unit.id;
  const inCompare = compareIds.includes(unit.id);
  const filteredOut =
    (filterTypology && unit.typology.code !== filterTypology) || (filterStatus && unit.status !== filterStatus);
  const hidden = floorCut !== null && unit.floor > floorCut;
  const isNight = t < 5.5 || t > 18.5;

  const baseColor = unitColor(unit, colorMode, range);
  const color = isSelected ? "#ffffff" : baseColor;
  // Ventanas encendidas de noche de manera determinista por unidad
  const lit = isNight && ((unit.floor * 31 + unit.position * 17) % 5 < 3);
  const emissive = isSelected ? "#e0b45a" : isHovered ? baseColor : lit ? "#ffd48a" : "#000000";
  const emissiveIntensity = isSelected ? 0.9 : isHovered ? 0.6 : lit ? 0.18 : 0;

  if (hidden) return null;

  return (
    <mesh
      position={position}
      castShadow
      receiveShadow
      onPointerOver={(e) => {
        if (!interactive) return;
        e.stopPropagation();
        hover(unit.id);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        if (!interactive) return;
        hover(null);
        document.body.style.cursor = "";
      }}
      onClick={(e) => {
        if (!interactive) return;
        e.stopPropagation();
        select(unit.id);
        onSelect?.(unit.id);
      }}
    >
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        roughness={0.45}
        metalness={0.15}
        transparent={!!filteredOut}
        opacity={filteredOut ? 0.12 : 1}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
      />
      <Edges color={isSelected ? "#e0b45a" : inCompare ? "#38bdf8" : "#0b1220"} threshold={15} lineWidth={isSelected || inCompare ? 2 : 1} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Modo GLB: modelo de la constructora con nodos nombrados T1_P12_U04
// ---------------------------------------------------------------------------
function GLBSite({
  url,
  units,
  range,
  interactive,
  onSelect,
}: {
  url: string;
  units: UnitGeom[];
  range: [number, number];
  interactive: boolean;
  onSelect?: (id: string | null) => void;
}) {
  const gltf = useGLTF(url);
  const select = useViewerStore((s) => s.select);
  const hover = useViewerStore((s) => s.hover);
  const state = useViewerStore();
  const byNode = useMemo(() => {
    const m = new Map<string, UnitGeom>();
    for (const u of units) {
      const node = (u as UnitGeom & { modelNodeName?: string | null }).modelNodeName ?? `${u.code.split("-")[0]}_P${String(u.floor).padStart(2, "0")}_U${String(u.position).padStart(2, "0")}`;
      m.set(node, u);
    }
    return m;
  }, [units]);

  // Clona materiales de los nodos de unidades para poder colorearlos de forma independiente.
  useEffect(() => {
    gltf.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (byNode.has(mesh.name) && !mesh.userData.cloned) {
        mesh.material = (mesh.material as THREE.Material).clone();
        mesh.userData.cloned = true;
      }
    });
  }, [gltf.scene, byNode]);

  // Aplica colores según estado/filtros/selección.
  useEffect(() => {
    gltf.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const unit = byNode.get(mesh.name);
      if (!unit) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      const filteredOut =
        (state.filterTypology && unit.typology.code !== state.filterTypology) ||
        (state.filterStatus && unit.status !== state.filterStatus);
      mesh.visible = !(state.floorCut !== null && unit.floor > state.floorCut);
      const isSelected = state.selectedUnitId === unit.id;
      const isHovered = state.hoveredUnitId === unit.id;
      mat.color.set(isSelected ? "#ffffff" : unitColor(unit, state.colorMode, range));
      mat.transparent = !!filteredOut;
      mat.opacity = filteredOut ? 0.12 : 1;
      if ("emissive" in mat) {
        mat.emissive.set(isSelected ? "#e0b45a" : isHovered ? mat.color : "#000000");
        mat.emissiveIntensity = isSelected ? 0.9 : isHovered ? 0.5 : 0;
      }
      mat.needsUpdate = true;
    });
  }, [gltf.scene, byNode, range, state.selectedUnitId, state.hoveredUnitId, state.colorMode, state.floorCut, state.filterTypology, state.filterStatus]);

  return (
    <primitive
      object={gltf.scene}
      onPointerOver={(e: { object: THREE.Object3D; stopPropagation: () => void }) => {
        if (!interactive) return;
        const unit = byNode.get(e.object.name);
        if (!unit) return;
        e.stopPropagation();
        hover(unit.id);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        if (!interactive) return;
        hover(null);
        document.body.style.cursor = "";
      }}
      onClick={(e: { object: THREE.Object3D; stopPropagation: () => void }) => {
        if (!interactive) return;
        const unit = byNode.get(e.object.name);
        if (!unit) return;
        e.stopPropagation();
        select(unit.id);
        onSelect?.(unit.id);
      }}
    />
  );
}

class GLBErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("No se pudo cargar el modelo GLB, usando modo paramétrico.", error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Cámara: vuelo a la unidad seleccionada y "vista desde el piso"
// ---------------------------------------------------------------------------
function CameraRig({ towers, units, center }: { towers: TowerGeom[]; units: UnitGeom[]; center: THREE.Vector3 }) {
  const { camera, controls } = useThree() as unknown as { camera: THREE.PerspectiveCamera; controls: OrbitControlsImpl | null };
  const selectedId = useViewerStore((s) => s.selectedUnitId);
  const cameraMode = useViewerStore((s) => s.cameraMode);
  const targetPos = useRef<THREE.Vector3 | null>(null);
  const targetLook = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    const unit = units.find((u) => u.id === selectedId);
    if (!unit) {
      if (cameraMode === "floorView") return;
      targetPos.current = null;
      targetLook.current = null;
      return;
    }
    const tower = towers.find((t) => t.id === unit.towerId);
    if (!tower) return;
    const { position, size } = placeUnit(tower, unit.floor, unit.position);
    const local = new THREE.Vector3(...position);
    const world = local.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), tower.rotationY).add(new THREE.Vector3(tower.positionX, 0, tower.positionZ));
    const outward = new THREE.Vector3(0, 0, local.z >= 0 ? 1 : -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), tower.rotationY);

    if (cameraMode === "floorView") {
      // Cámara en la ventana del apartamento mirando hacia afuera
      targetPos.current = world.clone().add(outward.clone().multiplyScalar(size[2] / 2 + 0.6)).add(new THREE.Vector3(0, 0.6, 0));
      targetLook.current = targetPos.current.clone().add(outward.clone().multiplyScalar(200)).add(new THREE.Vector3(0, -8, 0));
    } else {
      // Órbita cercana al apartamento
      targetPos.current = world.clone().add(outward.clone().multiplyScalar(58)).add(new THREE.Vector3(22, 16, 0));
      targetLook.current = world.clone();
    }
  }, [selectedId, cameraMode, towers, units]);

  useEffect(() => {
    if (cameraMode === "orbit" && !selectedId) {
      targetPos.current = null;
      targetLook.current = center.clone();
    }
  }, [cameraMode, selectedId, center]);

  useFrame((_, delta) => {
    if (!controls) return;
    const k = 1 - Math.pow(0.001, delta); // suavizado independiente del framerate
    if (targetLook.current) controls.target.lerp(targetLook.current, k * 0.9);
    if (targetPos.current) {
      camera.position.lerp(targetPos.current, k * 0.9);
      if (camera.position.distanceTo(targetPos.current) < 0.05) targetPos.current = null;
    }
    controls.update();
  });

  return null;
}
