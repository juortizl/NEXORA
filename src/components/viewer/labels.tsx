"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Etiquetas HTML proyectadas desde el 3D sin usar drei/Html (evita crear
 * raíces de React dentro del Canvas). LabelProjector corre dentro del Canvas y
 * escribe las coordenadas de pantalla en un registro mutable; LabelOverlay,
 * fuera del Canvas, las aplica al DOM en un rAF propio.
 */
export type SceneLabel = {
  id: string;
  position: [number, number, number];
  content: ReactNode;
  hidden?: boolean;
  /** Distancia a la que la etiqueta tiene escala 1 */
  refDistance?: number;
};

type Projected = { x: number; y: number; visible: boolean; scale: number };
const registry = new Map<string, Projected>();
const tmp = new THREE.Vector3();

export function LabelProjector({ labels }: { labels: SceneLabel[] }) {
  const { camera, size } = useThree();
  useFrame(() => {
    for (const label of labels) {
      tmp.set(...label.position);
      const dist = tmp.distanceTo(camera.position);
      tmp.project(camera);
      const visible = !label.hidden && tmp.z < 1 && Math.abs(tmp.x) < 1.2 && Math.abs(tmp.y) < 1.2;
      const x = ((tmp.x + 1) / 2) * size.width;
      const y = ((1 - tmp.y) / 2) * size.height;
      const ref = label.refDistance ?? 140;
      const scale = Math.min(1.3, Math.max(0.55, ref / Math.max(dist, 1)));
      const prev = registry.get(label.id);
      if (prev) {
        prev.x = x;
        prev.y = y;
        prev.visible = visible;
        prev.scale = scale;
      } else {
        registry.set(label.id, { x, y, visible, scale });
      }
    }
  });
  return null;
}

export function LabelOverlay({ labels }: { labels: SceneLabel[] }) {
  const nodes = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      for (const [id, el] of nodes.current) {
        const p = registry.get(id);
        if (!p) continue;
        el.style.display = p.visible ? "block" : "none";
        el.style.transform = `translate(-50%, -100%) translate(${p.x}px, ${p.y}px) scale(${p.scale})`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {labels.map((l) => (
        <div
          key={l.id}
          ref={(el) => {
            if (el) nodes.current.set(l.id, el);
            else nodes.current.delete(l.id);
          }}
          className="absolute left-0 top-0 origin-bottom"
          style={{ display: "none", willChange: "transform" }}
        >
          {l.content}
        </div>
      ))}
    </div>
  );
}
