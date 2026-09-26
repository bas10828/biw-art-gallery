"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { PAINTING_Y, WALL_HEIGHT, polar, type Slot } from "@/lib/gallery/layout";
import { tourState } from "@/lib/gallery/tourState";

let washTexture: THREE.Texture | null = null;
/** Soft radial falloff used for the light pool a spotlight leaves on the wall. */
function getWashTexture() {
  if (washTexture) return washTexture;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.45, "rgba(255,255,255,.35)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  washTexture = new THREE.CanvasTexture(c);
  return washTexture;
}

const beamVertex = /* glsl */ `
  varying float vHeight;
  varying float vFacing;
  void main() {
    vHeight = uv.y;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    vFacing = clamp(abs(dot(n, normalize(-mv.xyz))), 0.0, 1.0);
    gl_Position = projectionMatrix * mv;
  }
`;
const beamFragment = /* glsl */ `
  uniform float uIntensity;
  uniform vec3 uColor;
  varying float vHeight;
  varying float vFacing;
  void main() {
    float a = pow(vHeight, 1.6) * pow(vFacing, 2.0) * uIntensity;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

const WARM = new THREE.Color("#ffe6c4");

export default function Painting({
  slot,
  index,
  quality,
  onSelect,
}: {
  slot: Slot;
  index: number;
  quality: "sm" | "lg";
  onSelect: (index: number) => void;
}) {
  const { art, w, h, angle, apothem } = slot;
  const base = art.file.replace(/\.\w+$/, "");
  const texture = useTexture(`/images/tex/${quality}/${base}.webp`, (t) => {
    const tex = t as THREE.Texture;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = quality === "lg" ? 8 : 2;
  });

  const canvasMat = useRef<THREE.MeshBasicMaterial>(null);
  const washMat = useRef<THREE.MeshBasicMaterial>(null);
  const beam = useRef<THREE.ShaderMaterial>(null);
  const lit = useRef(0);

  const [x, z] = polar(angle, apothem - 0.02);

  // Beam from a ceiling fixture down onto the painting (local space: +z = into the room).
  const beamGeo = useMemo(() => {
    const top = new THREE.Vector3(0, WALL_HEIGHT - 0.3 - PAINTING_Y, 1.25);
    const bottom = new THREE.Vector3(0, -h * 0.1, 0.1);
    const axis = new THREE.Vector3().subVectors(top, bottom);
    const length = axis.length();
    const g = new THREE.ConeGeometry(Math.max(w, h) * 0.7, length, 32, 1, true);
    g.rotateY(Math.PI / 32);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize()));
    g.translate((top.x + bottom.x) / 2, (top.y + bottom.y) / 2, (top.z + bottom.z) / 2);
    return g;
  }, [w, h]);

  const beamUniforms = useMemo(
    () => ({ uIntensity: { value: 0.1 }, uColor: { value: WARM.clone() } }),
    []
  );

  useFrame((_, dt) => {
    // Brighten the painting the camera is visiting; the rest wait in half-light.
    const target = Math.max(0, 1 - Math.abs(tourState.progress - (index + 1)) * 1.3);
    lit.current = THREE.MathUtils.damp(lit.current, target, 4, dt);
    const l = lit.current;
    canvasMat.current?.color.setScalar(0.5 + 0.5 * l);
    if (washMat.current) washMat.current.opacity = 0.05 + 0.17 * l;
    if (beam.current) beam.current.uniforms.uIntensity.value = 0.03 + 0.09 * l;
  });

  const frame = 0.07;

  return (
    <group position={[x, PAINTING_Y, z]} rotation={[0, -angle, 0]}>
      {/* Light pool on the wall */}
      <mesh position={[0, 0.25, 0.01]}>
        <planeGeometry args={[w + 2.2, h + 2.4]} />
        <meshBasicMaterial
          ref={washMat}
          map={getWashTexture()}
          color={WARM}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Frame */}
      <mesh position={[0, 0, 0.04]}>
        <boxGeometry args={[w + frame * 2, h + frame * 2, 0.08]} />
        <meshStandardMaterial color="#0b0b0c" roughness={0.55} metalness={0.4} />
      </mesh>

      {/* Canvas */}
      <mesh
        position={[0, 0, 0.082]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(index);
        }}
        onPointerOver={() => (document.body.style.cursor = "zoom-in")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial ref={canvasMat} map={texture} toneMapped={false} />
      </mesh>

      {/* Plaque */}
      <mesh position={[w / 2 + 0.35, -h / 2 + 0.12, 0.02]}>
        <boxGeometry args={[0.22, 0.12, 0.012]} />
        <meshStandardMaterial color="#9c7c3a" roughness={0.5} metalness={0.3} />
      </mesh>

      <mesh geometry={beamGeo}>
        <shaderMaterial
          ref={beam}
          vertexShader={beamVertex}
          fragmentShader={beamFragment}
          uniforms={beamUniforms}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
