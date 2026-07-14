"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import * as THREE from "three";

export interface CoursePin {
  lat: number;
  lng: number;
  name: string;
  city: string;
}

interface GeoJson {
  features: object[];
}

/**
 * Minimal dotted-earth globe: light hex-polygon landmasses on a near-white
 * sphere, with glowing gold pins + pulsing rings at each active course. Auto
 * rotates; drag to spin. Rendered client-only (loaded via ssr:false).
 */
export default function GlobeInner({ courses }: { courses: CoursePin[] }) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState<GeoJson | null>(null);
  const [size, setSize] = useState(560);

  useEffect(() => {
    fetch("/geo/land.geojson")
      .then((r) => r.json())
      .then(setGeo)
      .catch(() => setGeo({ features: [] }));
  }, []);

  // Responsive square sizing from the container width.
  useEffect(() => {
    if (!wrapRef.current) return;
    const el = wrapRef.current;
    const ro = new ResizeObserver(() => {
      setSize(Math.min(640, Math.max(320, el.clientWidth)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Auto-rotate + framing once the globe is ready.
  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    const controls = g.controls() as unknown as {
      autoRotate: boolean;
      autoRotateSpeed: number;
      enableZoom: boolean;
    };
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;
    controls.enableZoom = false;
    g.pointOfView({ lat: 24, lng: -60, altitude: 2.2 }, 0);
  }, [geo]);

  const globeMaterial = useMemo(() => {
    return new THREE.MeshPhongMaterial({
      color: new THREE.Color("#f2f7ee"),
      transparent: true,
      opacity: 0.96,
      shininess: 4,
    });
  }, []);

  return (
    <div ref={wrapRef} className="flex w-full items-center justify-center">
      <Globe
        ref={globeRef}
        width={size}
        height={size}
        backgroundColor="rgba(0,0,0,0)"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        globeMaterial={globeMaterial as any}
        atmosphereColor="#8fd39f"
        atmosphereAltitude={0.16}
        hexPolygonsData={geo?.features ?? []}
        hexPolygonResolution={3}
        hexPolygonMargin={0.2}
        hexPolygonAltitude={0.01}
        hexPolygonColor={() => "rgba(13,53,34,0.55)"}
        pointsData={courses}
        pointLat="lat"
        pointLng="lng"
        pointColor={() => "#caa53f"}
        pointAltitude={0.035}
        pointRadius={0.42}
        pointLabel={(d) => {
          const c = d as CoursePin;
          return `<div style="background:#0d3522;color:#fff;padding:6px 10px;border-radius:8px;font:600 12px/1.3 Inter,sans-serif;box-shadow:0 8px 24px -8px rgba(0,0,0,.5)">${c.name}<div style="font-weight:400;opacity:.7">${c.city}</div></div>`;
        }}
        ringsData={courses}
        ringLat="lat"
        ringLng="lng"
        ringColor={() => (t: number) => `rgba(201,168,76,${1 - t})`}
        ringMaxRadius={4}
        ringPropagationSpeed={2}
        ringRepeatPeriod={1400}
      />
    </div>
  );
}
