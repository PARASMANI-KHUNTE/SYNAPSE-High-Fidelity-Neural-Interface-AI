import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';

// Infinite scrolling tactical grid
function TacticalGrid() {
  const gridRef = useRef();
  
  useFrame((state, delta) => {
    if (!gridRef.current) return;
    // Scroll the grid towards the camera to simulate moving forward
    gridRef.current.position.z += delta * 2;
    if (gridRef.current.position.z > 5) {
      gridRef.current.position.z -= 5; // loop seamless
    }
  });

  return (
    <group ref={gridRef}>
      {/* Floor Grid */}
      <gridHelper args={[60, 60, '#1e3a8a', '#0f172a']} position={[0, -2.5, -10]} />
      {/* Ceiling Grid */}
      <gridHelper args={[60, 60, '#1e3a8a', '#0f172a']} position={[0, 2.5, -10]} rotation={[Math.PI, 0, 0]} />
    </group>
  );
}

// Data Stream Lines (Fast moving laser lines)
function DataStreams({ count = 15, isSpeaking }) {
  const groupRef = useRef();
  const streams = useMemo(() => {
    let seed = 78901;
    const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    return Array.from({ length: count }).map((_, i) => {
      const x = (rand() - 0.5) * 20;
      const y = (rand() - 0.5) * 4;
      const z = -20 - rand() * 30;
      const length = 2 + rand() * 8;
      const speed = 10 + rand() * 20;
      const color = rand() > 0.8 ? '#ff2a2a' : '#00f0ff';
      return { id: i, x, y, z, length, speed, color };
    });
  }, [count]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const speedMultiplier = isSpeaking ? 2 : 1;
    groupRef.current.children.forEach((lineMesh, i) => {
       const stream = streams[i];
       lineMesh.position.z += stream.speed * delta * speedMultiplier;
       if (lineMesh.position.z > 5) {
         lineMesh.position.z = -30 - Math.random() * 20;
       }
    });
  });

  return (
    <group ref={groupRef}>
      {streams.map((stream) => (
        <Line
          key={stream.id}
          points={[
            [stream.x, stream.y, stream.z],
            [stream.x, stream.y, stream.z - stream.length]
          ]}
          color={stream.color}
          lineWidth={2}
          transparent
          opacity={0.6}
        />
      ))}
    </group>
  );
}

// Distant Geometric Nodes
function TacticalNodes() {
  const groupRef = useRef();
  
  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.1) * 0.1;
  });

  return (
    <group ref={groupRef}>
      <mesh position={[-8, 0, -15]} rotation={[Math.PI/4, Math.PI/4, 0]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#00f0ff" wireframe transparent opacity={0.15} />
      </mesh>
      <mesh position={[8, 1, -18]} rotation={[0, Math.PI/3, Math.PI/6]}>
        <octahedronGeometry args={[1.5, 0]} />
        <meshBasicMaterial color="#ff2a2a" wireframe transparent opacity={0.15} />
      </mesh>
    </group>
  );
}

export default function ThreeBackground({ isSpeaking }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        background: '#05070f' // Void background
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 0], fov: 60 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        dpr={[1, 1.5]}
      >
        <fog attach="fog" args={['#05070f', 5, 25]} />
        
        {/* Lights */}
        <ambientLight intensity={0.5} color="#1e3a8a" />
        <directionalLight position={[0, 10, -5]} intensity={1} color="#00f0ff" />
        
        {/* 3D Elements */}
        <TacticalGrid />
        <DataStreams isSpeaking={isSpeaking} count={25} />
        <TacticalNodes />
      </Canvas>
    </div>
  );
}
