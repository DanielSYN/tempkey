"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import type { Mesh } from "three";

interface Hero3DProps {
  className?: string;
}

/**
 * Abstract "access key" core: a low-poly icosahedron with a slightly larger
 * wireframe shell around it. Deliberately geometric rather than a literal
 * key/lock model — low polycount keeps it cheap to render and reads as
 * "digital access" rather than a specific object.
 */
function KeyCore({ paused }: { paused: boolean }) {
  const coreRef = useRef<Mesh>(null);
  const shellRef = useRef<Mesh>(null);

  useFrame((state, delta) => {
    if (paused) return;

    if (coreRef.current) {
      coreRef.current.rotation.y += delta * 0.18;
      // gentle mouse-driven tilt, eased toward the pointer position
      const targetTiltX = state.pointer.y * 0.25;
      const targetTiltZ = -state.pointer.x * 0.15;
      coreRef.current.rotation.x += (targetTiltX - coreRef.current.rotation.x) * 0.03;
      coreRef.current.rotation.z += (targetTiltZ - coreRef.current.rotation.z) * 0.03;
    }
    if (shellRef.current) {
      shellRef.current.rotation.y -= delta * 0.09;
      shellRef.current.rotation.x += delta * 0.03;
    }
  });

  return (
    <group>
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[1.3, 0]} />
        <meshStandardMaterial color="#0369A1" metalness={0.5} roughness={0.3} flatShading />
      </mesh>
      <mesh ref={shellRef} scale={1.4}>
        <icosahedronGeometry args={[1.3, 0]} />
        <meshBasicMaterial color="#4D7CFF" wireframe transparent opacity={0.45} />
      </mesh>
    </group>
  );
}

function Scene({ paused }: { paused: boolean }) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <pointLight position={[4, 3, 4]} intensity={55} color="#4D7CFF" />
      <pointLight position={[-4, -3, -2]} intensity={18} color="#0369A1" />
      <Float speed={paused ? 0 : 1.5} rotationIntensity={paused ? 0 : 0.5} floatIntensity={paused ? 0 : 0.7}>
        <KeyCore paused={paused} />
      </Float>
    </>
  );
}

export default function Hero3D({ className }: Hero3DProps) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mql.matches);

    const handleChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, []);

  return (
    <div className={`h-full w-full ${className ?? ""}`} aria-hidden="true">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 5.5], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        frameloop={reducedMotion ? "demand" : "always"}
      >
        <Scene paused={reducedMotion} />
      </Canvas>
    </div>
  );
}
