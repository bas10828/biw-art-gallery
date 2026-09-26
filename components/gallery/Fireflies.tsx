"use client";
import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSize;
  attribute float aPhase;
  attribute float aSpeed;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    p.x += sin(uTime * aSpeed + aPhase) * 0.4;
    p.y += sin(uTime * aSpeed * 0.7 + aPhase * 2.0) * 0.3;
    p.z += cos(uTime * aSpeed * 0.8 + aPhase) * 0.4;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPixelRatio / -mv.z;
    vAlpha = 0.45 + 0.55 * sin(uTime * aSpeed * 2.2 + aPhase * 3.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = pow(smoothstep(0.5, 0.0, d), 2.2) * max(vAlpha, 0.0);
    gl_FragColor = vec4(uColor * a, a);
  }
`;

export default function Fireflies({ count, radius }: { count: number; radius: number }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const dpr = useThree((s) => s.viewport.dpr);

  const attrs = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const phase = new Float32Array(count);
    const speed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * (radius - 0.8);
      pos[i * 3] = Math.sin(a) * r;
      pos[i * 3 + 1] = 0.3 + Math.random() * 5.5;
      pos[i * 3 + 2] = -Math.cos(a) * r;
      phase[i] = Math.random() * Math.PI * 2;
      speed[i] = 0.25 + Math.random() * 0.6;
    }
    return { pos, phase, speed };
  }, [count, radius]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: dpr },
      uSize: { value: 60 },
      uColor: { value: new THREE.Color("#d9ff7a").multiplyScalar(2.2) },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useFrame(({ clock }) => {
    if (!material.current) return;
    material.current.uniforms.uTime.value = clock.elapsedTime;
    material.current.uniforms.uPixelRatio.value = dpr;
  });

  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[attrs.pos, 3]} />
        <bufferAttribute attach="attributes-aPhase" args={[attrs.phase, 1]} />
        <bufferAttribute attach="attributes-aSpeed" args={[attrs.speed, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={material}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
