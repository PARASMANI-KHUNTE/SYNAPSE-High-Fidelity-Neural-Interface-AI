import { useRef, useState, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, Sphere, Torus, Octahedron, Line } from '@react-three/drei';
import * as THREE from 'three';

export function Avatar3DAssistant({ isTyping, isSpeaking }) {
  const groupRef = useRef();
  const coreRef = useRef();
  const faceGroupRef = useRef();
  const leftEyeRef = useRef();
  const rightEyeRef = useRef();
  const halo1Ref = useRef();
  const halo2Ref = useRef();
  
  const [blinkProgress, setBlinkProgress] = useState(0);
  const nextBlinkTime = useRef(3000);

  useEffect(() => {
    nextBlinkTime.current = performance.now() + Math.random() * 4000 + 1000;
  }, []);

  // Smooth interpolation values
  const currentLookAt = useRef(new THREE.Vector3(0, 0, 1));
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 1));
  const smoothBobY = useRef(0);

  const eyeColorNormal = '#00f0ff'; // Cyan
  const eyeColorActive = '#ff2a2a'; // Neon Red
  
  const eyeMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: eyeColorNormal }), []);
  const typingEyeMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ff9000' }), []);
  const speakingEyeMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: eyeColorActive }), []);
  
  const globalPointer = useRef(new THREE.Vector2(0, 0));

  useEffect(() => {
    const handleMouseMove = (e) => {
      globalPointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      globalPointer.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);
  
  useFrame((state, delta) => {
    const pointer = globalPointer.current;
    
    // Core rotation
    if (coreRef.current) {
      coreRef.current.rotation.y -= delta * (isSpeaking ? 1 : isTyping ? 0.5 : 0.2);
    }

    targetLookAt.current.set(pointer.x * 0.8, pointer.y * 0.8, 1).normalize();

    if (isTyping) {
      targetLookAt.current.set(Math.sin(state.clock.elapsedTime * 4) * 0.2, 0.2, 1).normalize();
    }

    currentLookAt.current.lerp(targetLookAt.current, 0.15);
    if (faceGroupRef.current) {
      faceGroupRef.current.lookAt(
        currentLookAt.current.x * 2.5,
        currentLookAt.current.y * 2.5,
        currentLookAt.current.z * 2.5
      );
    }

    // Blinking
    const time = performance.now();
    if (time > nextBlinkTime.current) {
      setBlinkProgress(1); 
      nextBlinkTime.current = time + Math.random() * 3000 + 1000;
    }

    if (blinkProgress > 0) {
      setBlinkProgress(Math.max(0, blinkProgress - delta * 8)); 
    }
    
    const eyeScaleY = blinkProgress > 0.5 ? (1 - blinkProgress) * 2 : blinkProgress * 2;
    const finalEyeScale = Math.max(0.05, 1 - eyeScaleY);

    if (leftEyeRef.current) leftEyeRef.current.scale.set(1, finalEyeScale, 1);
    if (rightEyeRef.current) rightEyeRef.current.scale.set(1, finalEyeScale, 1);

    // Bobs
    if (isSpeaking) {
      const bob = Math.sin(state.clock.elapsedTime * 20) * 0.05;
      smoothBobY.current = THREE.MathUtils.lerp(smoothBobY.current, bob, 0.3);
    } else {
      smoothBobY.current = THREE.MathUtils.lerp(smoothBobY.current, 0, 0.1);
    }

    if (groupRef.current) {
      groupRef.current.position.y = smoothBobY.current;
    }

    // Gyro Rings
    if (halo1Ref.current && halo2Ref.current) {
      const speed1 = isSpeaking ? 3 : isTyping ? 1.5 : 0.5;
      const speed2 = isSpeaking ? -2.5 : isTyping ? -1 : -0.3;
      halo1Ref.current.rotation.x += delta * speed1;
      halo1Ref.current.rotation.y += delta * speed1 * 0.5;
      
      halo2Ref.current.rotation.y += delta * speed2;
      halo2Ref.current.rotation.z += delta * speed2 * 0.8;
    }
  });

  const currentEyeMaterial = isSpeaking ? speakingEyeMaterial : isTyping ? typingEyeMaterial : eyeMaterial;
  const haloColor1 = isSpeaking ? '#ff2a2a' : isTyping ? '#ff9000' : '#00f0ff';
  const haloColor2 = isSpeaking ? '#ff9000' : isTyping ? '#00f0ff' : '#1e3a8a';

  return (
    <Float speed={2} rotationIntensity={0.1} floatIntensity={0.5}>
      <group ref={groupRef}>
        
        {/* Core Geometry - Wireframe Octahedron */}
        <group ref={coreRef}>
          <Octahedron args={[1.2, 1]}>
            <meshBasicMaterial color="#05070f" wireframe={true} />
          </Octahedron>
          <Octahedron args={[1.18, 1]}>
            <meshBasicMaterial color="#0a1120" />
          </Octahedron>
          
          {/* Internal glowing node */}
          <Sphere args={[0.4, 16, 16]}>
            <meshBasicMaterial color={haloColor1} opacity={isSpeaking ? 0.8 : 0.4} transparent />
          </Sphere>
        </group>

        {/* Orbiting Gyro Rings */}
        <group ref={halo1Ref}>
          <Torus args={[1.8, 0.02, 16, 100]}>
            <meshBasicMaterial color={haloColor1} />
          </Torus>
          <Torus args={[1.8, 0.08, 16, 100]}>
            <meshBasicMaterial color={haloColor1} transparent opacity={0.2} />
          </Torus>
        </group>

        <group ref={halo2Ref}>
          <Torus args={[2.0, 0.02, 16, 100]} rotation={[Math.PI / 2, 0, 0]}>
            <meshBasicMaterial color={haloColor2} />
          </Torus>
          <Torus args={[2.0, 0.05, 16, 100]} rotation={[Math.PI / 2, 0, 0]}>
            <meshBasicMaterial color={haloColor2} transparent opacity={0.2} />
          </Torus>
        </group>

        {/* Floating Face Elements (Visor/Eyes) */}
        <group ref={faceGroupRef}>
          {/* Scanner Visor Background */}
          <mesh position={[0, 0.2, 1.05]} scale={[0.8, 0.25, 0.05]}>
             <boxGeometry />
             <meshBasicMaterial color="#000" opacity={0.8} transparent />
          </mesh>

          {/* Left Eye */}
          <mesh ref={leftEyeRef} position={[-0.2, 0.2, 1.1]} scale={[0.15, 0.05, 0.05]}>
            <boxGeometry />
            <primitive object={currentEyeMaterial} attach="material" />
            <pointLight distance={2} intensity={isSpeaking ? 2 : 1} color={currentEyeMaterial.color} />
          </mesh>

          {/* Right Eye */}
          <mesh ref={rightEyeRef} position={[0.2, 0.2, 1.1]} scale={[0.15, 0.05, 0.05]}>
            <boxGeometry />
            <primitive object={currentEyeMaterial} attach="material" />
            <pointLight distance={2} intensity={isSpeaking ? 2 : 1} color={currentEyeMaterial.color} />
          </mesh>

          {/* Mouth / Data output waveform */}
          {isSpeaking && (
            <group position={[0, -0.1, 1.05]}>
               <mesh scale={[0.4, 0.02, 0.05]}>
                  <boxGeometry />
                  <meshBasicMaterial color="#ff2a2a" />
               </mesh>
               <mesh scale={[0.2, 0.05, 0.06]} position={[0, 0, 0]}>
                  <boxGeometry />
                  <meshBasicMaterial color="#ff2a2a" />
               </mesh>
            </group>
          )}
        </group>
      </group>
    </Float>
  );
}
