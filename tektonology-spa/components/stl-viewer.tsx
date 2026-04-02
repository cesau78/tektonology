"use client";

import { Suspense, useMemo } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { Edges, OrbitControls } from "@react-three/drei";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

export interface StlPart {
  url: string;
  color?: string;
  position?: [number, number, number];
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.55} />
      <hemisphereLight args={["#f4f4f5", "#a1a1aa", 0.9]} />
      <directionalLight position={[5, 6, 4]} intensity={2.4} />
      <directionalLight position={[-4, -2, -5]} intensity={1.1} />
      <directionalLight position={[0, 4, -6]} intensity={0.95} />
    </>
  );
}

function stlSurfaceMaterial(color: string) {
  return (
    <meshStandardMaterial color={color} roughness={0.38} metalness={0.14} />
  );
}

/** Crease outlines so form reads clearly while avoiding every STL triangle edge. */
function StlEdges() {
  return <Edges threshold={28} color="#27272a" lineWidth={1.25} />;
}

function SingleModel({ url, color = "#9ca3af" }: { url: string; color?: string }) {
  const geometry = useLoader(STLLoader, url);

  const centered = useMemo(() => {
    geometry.computeBoundingBox();
    geometry.center();
    return geometry;
  }, [geometry]);

  const scale = useMemo(() => {
    centered.computeBoundingBox();
    const bb = centered.boundingBox!;
    const maxDim = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z);
    return maxDim > 0 ? 2.5 / maxDim : 1;
  }, [centered]);

  return (
    <mesh geometry={centered} scale={scale}>
      {stlSurfaceMaterial(color)}
      <StlEdges />
    </mesh>
  );
}

function AssemblyModel({ parts }: { parts: StlPart[] }) {
  const geometries = useLoader(STLLoader, parts.map((p) => p.url));
  const geoArray = Array.isArray(geometries) ? geometries : [geometries];

  const { scale, center } = useMemo(() => {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < geoArray.length; i++) {
      const geo = geoArray[i];
      const [ox, oy, oz] = parts[i].position ?? [0, 0, 0];
      geo.computeBoundingBox();
      const bb = geo.boundingBox!;
      minX = Math.min(minX, bb.min.x + ox);
      minY = Math.min(minY, bb.min.y + oy);
      minZ = Math.min(minZ, bb.min.z + oz);
      maxX = Math.max(maxX, bb.max.x + ox);
      maxY = Math.max(maxY, bb.max.y + oy);
      maxZ = Math.max(maxZ, bb.max.z + oz);
    }
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;
    const maxDim = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
    return {
      scale: maxDim > 0 ? 2.5 / maxDim : 1,
      center: [cx, cy, cz] as [number, number, number],
    };
  }, [geoArray, parts]);

  return (
    <group scale={scale} position={[-center[0] * scale, -center[1] * scale, -center[2] * scale]}>
      {geoArray.map((geo, i) => {
        const pos = parts[i].position ?? [0, 0, 0];
        return (
          <mesh key={parts[i].url} geometry={geo} position={pos as [number, number, number]}>
            {stlSurfaceMaterial(parts[i].color ?? "#9ca3af")}
            <StlEdges />
          </mesh>
        );
      })}
    </group>
  );
}

export function StlViewer({ url, label, color, compact, rotation }: { url: string; label: string; color?: string; compact?: boolean; rotation?: [number, number, number] }) {
  const rot = rotation ? rotation.map((deg) => (deg * Math.PI) / 180) as [number, number, number] : undefined;
  return (
    <div className={compact ? "h-full" : "border border-border rounded-lg overflow-hidden bg-transparent"}>
      <div className={compact ? "h-full" : "h-64"}>
        <Canvas camera={{ position: [3, 2, 3], fov: 40 }} gl={{ alpha: true }} style={{ background: "transparent" }}>
          <Lights />
          <Suspense fallback={null}>
            <group rotation={rot}>
              <SingleModel url={url} color={color} />
            </group>
          </Suspense>
          <OrbitControls autoRotate autoRotateSpeed={2} enablePan={false} enableZoom={!compact} />
        </Canvas>
      </div>
      {!compact && label && (
        <div className="px-3 py-2 border-t border-border bg-white">
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
      )}
    </div>
  );
}

export function StlAssemblyViewer({ parts, label, compact, rotation }: { parts: StlPart[]; label: string; compact?: boolean; rotation?: [number, number, number] }) {
  const rot = rotation ? rotation.map((deg) => (deg * Math.PI) / 180) as [number, number, number] : undefined;
  return (
    <div className={compact ? "h-full" : "border border-border rounded-lg overflow-hidden bg-transparent"}>
      <div className={compact ? "h-full" : "h-64"}>
        <Canvas camera={{ position: [3, 2, 3], fov: 40 }} gl={{ alpha: true }} style={{ background: "transparent" }}>
          <Lights />
          <Suspense fallback={null}>
            <group rotation={rot}>
              <AssemblyModel parts={parts} />
            </group>
          </Suspense>
          <OrbitControls autoRotate autoRotateSpeed={2} enablePan={false} enableZoom={!compact} />
        </Canvas>
      </div>
      {!compact && label && (
        <div className="px-3 py-2 border-t border-border bg-white">
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
      )}
    </div>
  );
}
