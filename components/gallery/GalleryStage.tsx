"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { MeshReflectorMaterial, Stars, useProgress } from "@react-three/drei";
import * as THREE from "three";
import { ARTIST_PORTRAIT, TOUR } from "@/lib/artworks";
import {
  WALL_HEIGHT,
  buildPath,
  buildRoom,
  cameraFov,
  near,
  planShortcut,
  sampleShortcut,
  samplePose,
  shortcutDuration,
  type Pose,
  type Room,
  type Shortcut,
} from "@/lib/gallery/layout";
import { tourState } from "@/lib/gallery/tourState";
import Painting from "./Painting";
import SpiritTree from "./SpiritTree";
import Fireflies from "./Fireflies";

const FOG = "#03050b";
/** Tour distance beyond which the camera cuts across the room instead of walking the walls. */
const JUMP = 1.5;
/** How far the page may move during a shortcut before it re-plans toward the new spot. */
const RETARGET = 0.25;

function Walls({ room, dim }: { room: Room; dim: boolean }) {
  const line = useMemo(() => new THREE.Color("#2a6dff").multiplyScalar(dim ? 0.45 : 1.6), [dim]);
  const { width: W, depth: D } = room;
  // [x, z, yaw of a viewer facing the wall, wall length]
  const walls: [number, number, number, number][] = [
    [0, -D / 2, 0, W],
    [W / 2, 0, Math.PI / 2, D],
    [0, D / 2, Math.PI, W],
    [-W / 2, 0, -Math.PI / 2, D],
  ];
  return (
    <>
      {walls.map(([x, z, yaw, length]) => (
        <group key={yaw} position={[x, 0, z]} rotation={[0, -yaw, 0]}>
          <mesh position={[0, WALL_HEIGHT / 2, 0]}>
            <planeGeometry args={[length, WALL_HEIGHT]} />
            <meshStandardMaterial color="#1b2130" roughness={0.9} metalness={0} />
          </mesh>
          {/* Floor-level light line */}
          <mesh position={[0, 0.05, 0.03]}>
            <planeGeometry args={[length - 0.1, 0.025]} />
            <meshBasicMaterial color={line} toneMapped={false} />
          </mesh>
          {/* Cornice line */}
          <mesh position={[0, WALL_HEIGHT - 0.04, 0.03]}>
            <planeGeometry args={[length - 0.1, 0.02]} />
            <meshBasicMaterial color={line} toneMapped={false} transparent opacity={0.5} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function Floor({ room, reflect }: { room: Room; reflect: boolean }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[room.width, room.depth]} />
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

function CameraRig({ room, parallax }: { room: Room; parallax: boolean }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const path = useMemo(() => buildPath(room, size), [room, size]);
  const current = useRef<Pose | null>(null);
  const target = useRef<Pose>({ ...path.poses[0] });
  const walk = useRef({ velocity: 0, stride: 0, walking: false });
  const shortcut = useRef<{
    plan: Shortcut;
    time: number;
    progress: number;
    fromProgress: number;
  } | null>(null);
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
    const step = Math.min(dt, 0.1);
    const w = walk.current;
    // Arriving on a deep link / reload: start where the page is, don't walk there.
    if (!current.current) tourState.cameraProgress = tourState.progress;

    let pace: number;
    const jump = Math.abs(tourState.progress - tourState.cameraProgress) > JUMP;
    const sc = shortcut.current;
    if (!reduced && (sc ? Math.abs(tourState.progress - sc.progress) > RETARGET : jump)) {
      // Long jump: walk straight across the room instead of along every wall.
      // Starts from wherever the camera is now, even mid-shortcut.
      const to = samplePose(path, tourState.progress, { ...target.current });
      shortcut.current = {
        plan: planShortcut(room, { ...target.current }, to),
        time: 0,
        progress: tourState.progress,
        fromProgress: tourState.cameraProgress,
      };
      w.velocity = 0;
    }

    if (shortcut.current) {
      const s = shortcut.current;
      s.time += step;
      const { speed, walked } = sampleShortcut(s.plan, s.time, target.current);
      // Light the destination once past halfway, not every painting passed.
      tourState.cameraProgress = walked < 0.5 ? s.fromProgress : s.progress;
      pace = Math.min(1, speed / 1.0);
      w.stride += Math.min(2, speed / 0.7) * step; // ~0.7 m steps, never faster than a brisk 2 per second
      if (s.time >= shortcutDuration(s.plan)) {
        shortcut.current = null;
        tourState.cameraProgress = s.progress;
        samplePose(path, s.progress, target.current);
        // The shortcut may end a whole turn away from the wall path's yaw.
        if (current.current) current.current.yaw = near(current.current.yaw, target.current.yaw);
      }
    } else {
      // Step to the neighbouring painting at a human pace.
      const diff = tourState.progress - tourState.cameraProgress;
      const maxSpeed = reduced ? 50 : 0.6;
      const desired = THREE.MathUtils.clamp(diff * 2.2, -maxSpeed, maxSpeed);
      w.velocity = THREE.MathUtils.damp(w.velocity, desired, 4, step);
      tourState.cameraProgress += w.velocity * step;
      if (Math.abs(diff) < 1e-4 && Math.abs(w.velocity) < 1e-3) {
        tourState.cameraProgress = tourState.progress;
        w.velocity = 0;
      }
      samplePose(path, tourState.cameraProgress, target.current);
      // Head bob: about six steps per painting, fading in and out with speed.
      pace = Math.min(1, Math.abs(w.velocity) / 0.35);
      w.stride += Math.abs(w.velocity) * step * 6;
    }

    if (!current.current) current.current = { ...target.current };
    const c = current.current;
    for (const key of Object.keys(c) as (keyof Pose)[]) {
      c[key] = THREE.MathUtils.damp(c[key], target.current[key], reduced ? 20 : 9, step);
    }

    // Kept small: a strong bob and side sway made visitors dizzy.
    const bobY = reduced ? 0 : Math.abs(Math.sin(w.stride * Math.PI)) * 0.015 * pace;

    const walking = !!shortcut.current || pace > 0.25;
    if (walking !== w.walking) {
      w.walking = walking;
      document.documentElement.dataset.walking = walking ? "1" : "0";
    }

    const { x, z } = c;
    let px = 0;
    let py = 0;
    if (parallax) {
      px = tourState.pointerX * 0.12;
      py = tourState.pointerY * 0.08;
    }
    // Camera-right for a camera looking along `yaw`.
    const rx = Math.cos(c.yaw);
    const rz = Math.sin(c.yaw);
    camera.position.set(x + rx * px, c.y + py + bobY, z + rz * px);
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
  const room = useMemo(() => buildRoom([...TOUR, ARTIST_PORTRAIT]), []);
  const high = quality === "lg";

  return (
    <>
      <color attach="background" args={[FOG]} />
      <fog attach="fog" args={[FOG, 9, Math.max(room.width, room.depth) * 1.7]} />
      <ambientLight intensity={0.5} color="#8ea2ff" />
      <hemisphereLight args={["#2a3f7a", "#050505", 0.5]} />

      <CameraRig room={room} parallax={high} />
      <Stars radius={70} depth={30} count={high ? 2600 : 1200} factor={3.2} saturation={0.4} fade speed={0.4} />

      <Walls room={room} dim={!high} />
      <Floor room={room} reflect={high} />
      <SpiritTree lowPower={!high} />
      <Fireflies count={high ? 220 : 90} radius={Math.min(room.width, room.depth) / 2} />

      {room.slots.map((slot, i) => (
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
