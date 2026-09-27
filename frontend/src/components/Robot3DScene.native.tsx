// Heavy native Three.js scene, loaded lazily by Robot3D.native.tsx.
/* eslint-disable react/no-unknown-property -- @react-three/fiber JSX intrinsics */
import React, { useMemo, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber/native';
import type { Group, Mesh, MeshStandardMaterial } from 'three';

import { colors } from '@/src/theme';

export type RobotMood = 'idle' | 'happy' | 'worried' | 'celebrating' | 'sleepy' | 'wave' | 'thinking';

type Props = {
  mood?: RobotMood;
  stage?: 1 | 2 | 3 | 4 | 5;
  size?: number;
  testID?: string;
};

function stageParams(stage: number) {
  switch (stage) {
    case 5:
      return { scale: 1.2, accent: '#7DD3C0', glow: 1, antenna: true, halo: true };
    case 4:
      return { scale: 1.1, accent: '#9CAF88', glow: 0.6, antenna: true, halo: false };
    case 3:
      return { scale: 1.0, accent: '#E9C46A', glow: 0.35, antenna: true, halo: false };
    case 2:
      return { scale: 0.9, accent: '#F4A261', glow: 0.18, antenna: true, halo: false };
    default:
      return { scale: 0.76, accent: '#F4A261', glow: 0, antenna: false, halo: false };
  }
}

function RobotBody({ mood, stage }: { mood: RobotMood; stage: number }) {
  const group = useRef<Group>(null);
  const leftEye = useRef<Mesh>(null);
  const rightEye = useRef<Mesh>(null);
  const antennaBall = useRef<Mesh & { material: MeshStandardMaterial }>(null);
  const armLeft = useRef<Group>(null);
  const armRight = useRef<Group>(null);

  const params = useMemo(() => stageParams(stage), [stage]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (!group.current) return;
    // idle float
    group.current.position.y = Math.sin(t * 1.4) * 0.06;
    // head bob per mood
    switch (mood) {
      case 'celebrating':
        group.current.rotation.z = Math.sin(t * 6) * 0.15;
        group.current.position.y += Math.abs(Math.sin(t * 4)) * 0.1;
        break;
      case 'wave':
        if (armRight.current) armRight.current.rotation.z = -0.6 + Math.sin(t * 6) * 0.5;
        break;
      case 'worried':
        group.current.rotation.z = Math.sin(t * 2) * 0.03;
        break;
      case 'sleepy':
        group.current.rotation.x = Math.sin(t * 0.6) * 0.05 + 0.08;
        break;
      case 'thinking':
        group.current.rotation.y = Math.sin(t * 0.8) * 0.25;
        break;
      default:
        group.current.rotation.y = Math.sin(t * 0.6) * 0.12;
    }
    // blink
    const blink = Math.sin(t * 1.6) > 0.985 ? 0.1 : 1;
    if (leftEye.current) leftEye.current.scale.y = blink;
    if (rightEye.current) rightEye.current.scale.y = blink;
    if (armLeft.current) armLeft.current.rotation.z = mood === 'celebrating' ? 0.9 + Math.sin(t * 6) * 0.18 : Math.sin(t * 1.2) * 0.04;
    if (armRight.current && mood !== 'wave') armRight.current.rotation.z = mood === 'celebrating' ? -0.9 - Math.sin(t * 6) * 0.18 : -Math.sin(t * 1.2) * 0.04;
    // antenna pulse
    if (antennaBall.current) {
      const s = 1 + Math.sin(t * 2.5) * 0.12;
      antennaBall.current.scale.setScalar(s);
    }
  });

  const mouthShape = (() => {
    switch (mood) {
      case 'happy':
      case 'celebrating':
        return { y: -0.28, width: 0.28, height: 0.08 };
      case 'worried':
        return { y: -0.22, width: 0.16, height: 0.04 };
      case 'sleepy':
        return { y: -0.24, width: 0.1, height: 0.04 };
      default:
        return { y: -0.24, width: 0.2, height: 0.05 };
    }
  })();

  return (
    <group ref={group} scale={params.scale}>
      {/* antenna */}
      {params.antenna && (
        <>
          <mesh position={[0, 1.35, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.35, 12]} />
            <meshStandardMaterial color={colors.brand} />
          </mesh>
          <mesh ref={antennaBall} position={[0, 1.6, 0]}>
            <sphereGeometry args={[0.11, 24, 24]} />
            <meshStandardMaterial color={params.accent} emissive={params.accent} emissiveIntensity={0.6 + params.glow} />
          </mesh>
        </>
      )}

      {/* halo for final stage */}
      {params.halo && (
        <mesh position={[0, 1.15, -0.02]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.75, 0.02, 16, 64]} />
          <meshStandardMaterial color={params.accent} emissive={params.accent} emissiveIntensity={0.9} />
        </mesh>
      )}

      {stage >= 3 && (
        <>
          <mesh position={[-0.67, 0.62, 0]}><sphereGeometry args={[0.12, 20, 20]} /><meshStandardMaterial color={params.accent} metalness={0.35} /></mesh>
          <mesh position={[0.67, 0.62, 0]}><sphereGeometry args={[0.12, 20, 20]} /><meshStandardMaterial color={params.accent} metalness={0.35} /></mesh>
        </>
      )}
      {stage >= 4 && (
        <>
          <mesh position={[0, -0.35, 0.405]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.23, 0.025, 12, 40]} /><meshStandardMaterial color={params.accent} emissive={params.accent} emissiveIntensity={params.glow} /></mesh>
          <mesh position={[-0.52, -0.3, 0]}><boxGeometry args={[0.12, 0.42, 0.5]} /><meshStandardMaterial color={params.accent} metalness={0.5} roughness={0.25} /></mesh>
          <mesh position={[0.52, -0.3, 0]}><boxGeometry args={[0.12, 0.42, 0.5]} /><meshStandardMaterial color={params.accent} metalness={0.5} roughness={0.25} /></mesh>
        </>
      )}

      {/* head */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={stage === 1 ? [1.34, 1.16, 1.08] : [1.2, 1.05, 1.05]} />
        <meshStandardMaterial color="#FFFFFF" roughness={0.35} metalness={0.15} />
      </mesh>

      {/* visor */}
      <mesh position={[0, 0.55, 0.55]}>
        <boxGeometry args={[1.0, 0.55, 0.02]} />
        <meshStandardMaterial color="#2A2119" roughness={0.15} metalness={0.4} />
      </mesh>

      {/* eyes */}
      <mesh ref={leftEye} position={[-0.22, 0.6, 0.57]}>
        <sphereGeometry args={[0.09, 20, 20]} />
        <meshStandardMaterial color="#E9C46A" emissive="#E9C46A" emissiveIntensity={0.7 + params.glow} />
      </mesh>
      <mesh ref={rightEye} position={[0.22, 0.6, 0.57]}>
        <sphereGeometry args={[0.09, 20, 20]} />
        <meshStandardMaterial color="#E9C46A" emissive="#E9C46A" emissiveIntensity={0.7 + params.glow} />
      </mesh>

      {/* cheek blush */}
      <mesh position={[-0.5, 0.4, 0.5]}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial color="#F4A261" transparent opacity={0.6} />
      </mesh>
      <mesh position={[0.5, 0.4, 0.5]}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial color="#F4A261" transparent opacity={0.6} />
      </mesh>

      {/* mouth */}
      <mesh position={[0, 0.55 + mouthShape.y, 0.57]}>
        <boxGeometry args={[mouthShape.width, mouthShape.height, 0.02]} />
        <meshStandardMaterial color="#2A2119" />
      </mesh>

      {/* body */}
      <mesh position={[0, -0.35, 0]}>
        <boxGeometry args={stage === 1 ? [0.72, 0.58, 0.68] : stage === 2 ? [0.82, 0.68, 0.72] : [0.9, 0.75, 0.75]} />
        <meshStandardMaterial color="#FFFFFF" roughness={0.4} />
      </mesh>

      {/* chest core */}
      <mesh position={[0, -0.35, 0.4]}>
        <sphereGeometry args={[0.13, 24, 24]} />
        <meshStandardMaterial color={params.accent} emissive={params.accent} emissiveIntensity={0.6 + params.glow} />
      </mesh>

      {/* arms */}
      <group ref={armLeft} position={[-0.55, -0.15, 0]}>
        <mesh position={[-0.12, -0.25, 0]}>
          <sphereGeometry args={[0.13, 20, 20]} />
          <meshStandardMaterial color="#FFFFFF" />
        </mesh>
      </group>
      <group ref={armRight} position={[0.55, -0.15, 0]}>
        <mesh position={[0.12, -0.25, 0]}>
          <sphereGeometry args={[0.13, 20, 20]} />
          <meshStandardMaterial color="#FFFFFF" />
        </mesh>
      </group>

      {/* feet */}
      <mesh position={[-0.22, -0.85, 0.1]}>
        <boxGeometry args={[0.28, 0.14, 0.34]} />
        <meshStandardMaterial color="#EBE3DB" />
      </mesh>
      <mesh position={[0.22, -0.85, 0.1]}>
        <boxGeometry args={[0.28, 0.14, 0.34]} />
        <meshStandardMaterial color="#EBE3DB" />
      </mesh>

      {/* shadow blob */}
      <mesh position={[0, -1.0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.55, 32]} />
        <meshBasicMaterial color="#2A2119" transparent opacity={0.12} />
      </mesh>
    </group>
  );
}

export default function Robot3D({ mood = 'idle', stage = 1, size = 200, testID }: Props) {
  return (
    <View style={[styles.wrap, { width: size, height: size }]} testID={testID}>
      <Canvas camera={{ position: [0, 0.2, 3.4], fov: 42 }} style={styles.canvas}>
        <ambientLight intensity={0.9} />
        <directionalLight position={[3, 5, 5]} intensity={0.9} castShadow />
        <directionalLight position={[-3, 2, -2]} intensity={0.35} color={'#F4A261'} />
        <RobotBody mood={mood} stage={stage} />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  // The centred wrapper disables the default cross-axis stretch. Without an
  // explicit width the GLView can measure at zero pixels and render blank.
  canvas: { width: '100%', height: '100%', backgroundColor: 'transparent' },
});
