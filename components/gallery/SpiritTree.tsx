"use client";
import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// The artist's recurring motif — a leafless tree — grown procedurally in the
// middle of the hall, with glowing tips and hanging moss.

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Segment {
  start: THREE.Vector3;
  end: THREE.Vector3;
  radius: number;
  depth: number;
}

const MAX_DEPTH = 6;
const BENDS = 3;
/** Radius ratio from one piece to the next; matches the cylinder geometry taper. */
const TAPER = 0.86;
const UP = new THREE.Vector3(0, 1, 0);

function growTree(seed: number) {
  const rand = mulberry32(seed);
  const segments: Segment[] = [];

  function grow(start: THREE.Vector3, heading: THREE.Vector3, len: number, radius: number, depth: number) {
    // Each branch is a few short pieces, each bent a little, so limbs curve.
    let end = start;
    let dir = heading;
    let r = radius;
    for (let s = 0; s < BENDS; s++) {
      const axis = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
      dir = dir.clone().applyAxisAngle(axis, (rand() - 0.5) * 0.45).normalize();
      const next = end.clone().addScaledVector(dir, len / BENDS);
      next.y = Math.max(next.y, 0.02);
      segments.push({ start: end, end: next, radius: r, depth });
      end = next;
      r *= TAPER;
    }
    if (depth >= MAX_DEPTH) return;

    const count = depth < 2 ? 3 : rand() < 0.3 ? 3 : 2;
    const phase = rand() * Math.PI * 2;
    for (let k = 0; k < count; k++) {
      // Tilt away from the parent direction, spread evenly around it.
      const side = new THREE.Vector3(1, 0, 0);
      if (Math.abs(dir.x) > 0.9) side.set(0, 0, 1);
      side.cross(dir).normalize();
      const around = phase + (k / count) * Math.PI * 2 + (rand() - 0.5) * 0.8;
      side.applyAxisAngle(dir, around);
      const tilt = 0.38 + rand() * 0.42 + depth * 0.03;
      const child = dir.clone().applyAxisAngle(side, tilt);
      child.y += 0.12; // reach for the light
      child.normalize();
      grow(end, child, len * (0.7 + rand() * 0.12), r * 0.95, depth + 1);
    }
  }

  grow(new THREE.Vector3(0, 0, 0), UP.clone(), 1.9, 0.24, 0);

  // Roots, spreading along the floor.
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + rand() * 0.5;
    const dir = new THREE.Vector3(Math.cos(a), -0.25, Math.sin(a)).normalize();
    let start = new THREE.Vector3(0, 0.35, 0);
    let radius = 0.09;
    for (let s = 0; s < 3; s++) {
      const end = start.clone().addScaledVector(dir, 0.9 + rand() * 0.5);
      end.y = Math.max(0.03, end.y);
      segments.push({ start, end, radius, depth: 1 + s });
      start = end;
      radius *= 0.6;
      dir.applyAxisAngle(UP, (rand() - 0.5) * 0.9).setY(-0.05).normalize();
    }
  }

  return { segments, rand };
}

// Rim-lit bark: dark core, glowing silhouette — reads as bioluminescent.
const branchVertex = /* glsl */ `
  varying vec3 vColor;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vNormal = normalize(mat3(modelMatrix * instanceMatrix) * normal);
    vView = cameraPosition - world.xyz;
    vColor = instanceColor;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
const branchFragment = /* glsl */ `
  varying vec3 vColor;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    // Clamp: a dot product a hair above 1 makes pow() return NaN, and Bloom
    // smears a single NaN pixel across the whole frame (black screen).
    float facing = clamp(abs(dot(normalize(vNormal), normalize(vView))), 0.0, 1.0);
    float rim = pow(1.0 - facing, 2.4);
    gl_FragColor = vec4(vColor * (0.16 + 1.5 * rim), 1.0);
  }
`;

const BARK = new THREE.Color("#10265c");
const GLOW = new THREE.Color("#35d6ff");
const MOSS = new THREE.Color("#3dffa8");

export default function SpiritTree({ lowPower }: { lowPower: boolean }) {
  const group = useRef<THREE.Group>(null);
  const branches = useRef<THREE.InstancedMesh>(null);

  const { segments, tips, moss } = useMemo(() => {
    const { segments, rand } = growTree(7);

    // Glowing buds at the end of the finest twigs.
    const tipPos: number[] = [];
    const tipCol: number[] = [];
    const pink = new THREE.Color("#ff7ab8");
    for (const s of segments) {
      if (s.depth < MAX_DEPTH - 1 || s.end.y < 1) continue;
      tipPos.push(s.end.x, s.end.y, s.end.z);
      const c = rand() < 0.18 ? pink : rand() < 0.5 ? MOSS : GLOW;
      tipCol.push(c.r * 2.4, c.g * 2.4, c.b * 2.4);
    }

    // Moss hanging from the mid branches (a nod to "Moss-Drip Tree").
    const mossPos: number[] = [];
    const mossCol: number[] = [];
    for (const s of segments) {
      if (s.depth < 2 || s.depth > 5 || s.end.y < 2) continue;
      const strands = lowPower ? 1 : 2;
      for (let k = 0; k < strands; k++) {
        const p = s.start.clone().lerp(s.end, rand());
        const len = 0.25 + rand() * 1.1;
        mossPos.push(p.x, p.y, p.z, p.x, p.y - len, p.z);
        mossCol.push(MOSS.r * 1.4, MOSS.g * 1.4, MOSS.b * 1.4, 0, 0, 0);
      }
    }
    return {
      segments,
      tips: { pos: new Float32Array(tipPos), col: new Float32Array(tipCol) },
      moss: { pos: new Float32Array(mossPos), col: new Float32Array(mossCol) },
    };
  }, [lowPower]);

  const geometry = useMemo(() => {
    const g = new THREE.CylinderGeometry(TAPER, 1, 1.04, 8, 1);
    g.translate(0, 0.5, 0); // grow from the base
    return g;
  }, []);

  useLayoutEffect(() => {
    const mesh = branches.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const color = new THREE.Color();
    segments.forEach((s, i) => {
      dir.subVectors(s.end, s.start);
      const len = dir.length();
      q.setFromUnitVectors(UP, dir.normalize());
      scale.set(s.radius, len, s.radius);
      m.compose(s.start, q, scale);
      mesh.setMatrixAt(i, m);
      const t = Math.pow(s.depth / MAX_DEPTH, 1.6);
      color.copy(BARK).lerp(GLOW, t).multiplyScalar(0.9 + t * 0.8);
      mesh.setColorAt(i, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [segments]);

  // Round, soft sprite for the buds (plain points render as squares).
  const dot = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.35, "rgba(255,255,255,.5)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }, []);

  const tipMaterial = useRef<THREE.PointsMaterial>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (group.current) group.current.rotation.y = t * 0.02;
    if (tipMaterial.current) tipMaterial.current.opacity = 0.75 + Math.sin(t * 1.3) * 0.25;
  });

  return (
    <group ref={group}>
      <instancedMesh ref={branches} args={[geometry, undefined, segments.length]} frustumCulled={false}>
        <shaderMaterial vertexShader={branchVertex} fragmentShader={branchFragment} />
      </instancedMesh>

      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[tips.pos, 3]} />
          <bufferAttribute attach="attributes-color" args={[tips.col, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={tipMaterial}
          size={0.16}
          map={dot}
          vertexColors
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>

      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[moss.pos, 3]} />
          <bufferAttribute attach="attributes-color" args={[moss.col, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.7}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </lineSegments>

      {/* Glow the tree casts on the floor and walls. */}
      <pointLight position={[0, 3.2, 0]} color="#2f8dff" intensity={26} distance={18} decay={1.6} />
    </group>
  );
}
