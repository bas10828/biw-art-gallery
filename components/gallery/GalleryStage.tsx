"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { MeshReflectorMaterial, Stars, useProgress } from "@react-three/drei";
import * as THREE from "three";
import { TOUR } from "@/lib/artworks";
import {
  WALL_HEIGHT,
  buildHall,
  buildPoses,
  cameraFov,
  polar,
  samplePose,
  type Hall,
  type Pose,
} from "@/lib/gallery/layout";
import { tourState } from "@/lib/gallery/tourState";
import Painting from "./Painting";
import SpiritTree from "./SpiritTree";
import Fireflies from "./Fireflies";

const FOG = "#03050b";

function Walls({ hall, dim }: { hall: Hall; dim: boolean }) {
  const line = useMemo(() => new THREE.Color("#2a6dff").multiplyScalar(dim ? 0.45 : 1.6), [dim]);
  return (
    <>
      {hall.slots.map((s) => {
        const [x, z] = polar(s.angle, s.apothem);
        const [lx, lz] = polar(s.angle, s.apothem - 0.03);
        return (
          <group key={s.art.id}>
            <mesh position={[x, WALL_HEIGHT / 2, z]} rotation={[0, -s.angle, 0]}>
              <planeGeometry args={[s.chord + 0.02, WALL_HEIGHT]} />
              <meshStandardMaterial color="#1b2130" roughness={0.9} metalness={0} />
            </mesh>
            {/* Floor-level light line */}
            <mesh position={[lx, 0.05, lz]} rotation={[0, -s.angle, 0]}>
              <planeGeometry args={[s.chord, 0.025]} />
              <meshBasicMaterial color={line} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

function Floor({ radius, reflect }: { radius: number; reflect: boolean }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <circleGeometry args={[radius + 0.5, 96]} />
      {reflect ? (
        <MeshReflectorMaterial
          blur={[400, 120]}
          resolution={1024}
          mixBlur={1}
          mixStrength={9}
          roughness={1}
          depthScale={1.1}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.4}
          color="#0b0e16"
          metalness={0.6}
          mirror={0.6}
        />
      ) : (
        <meshStandardMaterial color="#0b0e16" roughness={0.4} metalness={0.55} />
      )}
    </mesh>
  );
}

function CameraRig({ hall, parallax }: { hall: Hall; parallax: boolean }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const poses = useMemo(() => buildPoses(hall, size), [hall, size]);
  const current = useRef<Pose | null>(null);
  const target = useRef<Pose>({ ...poses[0] });
  const look = useMemo(() => new THREE.Vector3(), []);
  const reduced = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  useEffect(() => {
    camera.fov = cameraFov(size);
    camera.updateProjectionMatrix();
  }, [camera, size]);

  useFrame((_, dt) => {
    samplePose(poses, tourState.progress, target.current);
    if (!current.current) current.current = { ...target.current };
    const c = current.current;
    const k = reduced ? 12 : 2.6;
    const step = Math.min(dt, 0.1);
    for (const key of Object.keys(c) as (keyof Pose)[]) {
      c[key] = THREE.MathUtils.damp(c[key], target.current[key], k, step);
    }

    const [x, z] = polar(c.angle, c.r);
    let px = 0;
    let py = 0;
    if (parallax) {
      px = tourState.pointerX * 0.12;
      py = tourState.pointerY * 0.08;
    }
    // Camera-right for a camera looking along `yaw`.
    const rx = Math.cos(c.yaw);
    const rz = Math.sin(c.yaw);
    camera.position.set(x + rx * px, c.y + py, z + rz * px);
    look.set(
      camera.position.x + Math.sin(c.yaw) * Math.cos(c.pitch),
      camera.position.y + Math.sin(c.pitch),
      camera.position.z - Math.cos(c.yaw) * Math.cos(c.pitch)
    );
    camera.lookAt(look);

    const { width, height } = size;
    camera.setViewOffset(width, height, (-c.shiftX * width) / 2, (c.shiftY * height) / 2, width, height);
  });

  return null;
}

function Scene({
  quality,
  onSelect,
}: {
  quality: "sm" | "lg";
  onSelect: (index: number) => void;
}) {
  const hall = useMemo(() => buildHall(TOUR), []);
  const high = quality === "lg";

  return (
    <>
      <color attach="background" args={[FOG]} />
      <fog attach="fog" args={[FOG, 9, hall.radius * 3.2]} />
      <ambientLight intensity={0.5} color="#8ea2ff" />
      <hemisphereLight args={["#2a3f7a", "#050505", 0.5]} />

      <CameraRig hall={hall} parallax={high} />
      <Stars radius={70} depth={30} count={high ? 2600 : 1200} factor={3.2} saturation={0.4} fade speed={0.4} />

      <Walls hall={hall} dim={!high} />
      <Floor radius={hall.radius} reflect={high} />
      <SpiritTree lowPower={!high} />
      <Fireflies count={high ? 220 : 90} radius={hall.radius} />

      {hall.slots.map((slot, i) => (
        <Painting key={slot.art.id} slot={slot} index={i} quality={quality} onSelect={onSelect} />
      ))}

    </>
  );
}

function Loader({ label, done }: { label: string; done: boolean }) {
  const { progress } = useProgress();
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-8 z-20 flex flex-col items-center gap-2 transition-opacity duration-700"
      style={{ opacity: done ? 0 : 1 }}
      aria-hidden={done}
    >
      <span className="text-[11px] tracking-[.25em] uppercase text-ink2">
        {label} · {Math.round(progress)}%
      </span>
      <span className="block h-px w-40 overflow-hidden bg-white/10">
        <span
          className="block h-full bg-gold transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </span>
    </div>
  );
}

export default function GalleryStage({
  loadingLabel,
  onSelect,
  paused,
}: {
  loadingLabel: string;
  onSelect: (index: number) => void;
  paused: boolean;
}) {
  const [quality] = useState<"sm" | "lg">(() =>
    window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768 ? "sm" : "lg"
  );
  const { active, progress } = useProgress();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!active && progress === 100) {
      const t = setTimeout(() => setReady(true), 250);
      return () => clearTimeout(t);
    }
  }, [active, progress]);

  return (
    <>
      <div
        className="fixed inset-0 z-0 transition-opacity duration-[1600ms]"
        style={{ opacity: ready ? 1 : 0 }}
      >
        <Canvas
          flat
          dpr={quality === "lg" ? [1, 2] : [1, 1.5]}
          frameloop={paused ? "never" : "always"}
          camera={{ fov: 50, near: 0.1, far: 120, position: [0, 2.5, 8] }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          style={{ touchAction: "pan-y" }}
        >
          <Suspense fallback={null}>
            <Scene quality={quality} onSelect={onSelect} />
          </Suspense>
        </Canvas>
      </div>
      <Loader label={loadingLabel} done={ready} />
    </>
  );
}
