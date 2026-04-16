import { useRef, useState, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, Sphere, Torus, Octahedron, Line, Stars } from '@react-three/drei';
import * as THREE from 'three';

function ParticleField({ isActive }) {
  const particlesRef = useRef();
  const particleCount = 50;
  
  const positions = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 4;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 4;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 4;
    }
    return pos;
  }, []);

  useFrame((state, delta) => {
    if (particlesRef.current && isActive) {
      particlesRef.current.rotation.y += delta * 0.2;
      particlesRef.current.rotation.x += delta * 0.1;
      const positions = particlesRef.current.geometry.attributes.position.array;
      for (let i = 0; i < particleCount; i++) {
        positions[i * 3 + 1] += Math.sin(state.clock.elapsedTime * 2 + i) * 0.002;
      }
      particlesRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.03}
        color={isActive ? "#ff2a2a" : "#00f0ff"}
        transparent
        opacity={isActive ? 0.8 : 0.3}
        sizeAttenuation
      />
    </points>
  );
}

function EnergyPulse({ isActive }) {
  const pulseRef = useRef();
  
  useFrame((state) => {
    if (pulseRef.current && isActive) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 8) * 0.1;
      pulseRef.current.scale.set(scale, scale, scale);
      pulseRef.current.material.opacity = 0.2 + Math.sin(state.clock.elapsedTime * 8) * 0.1;
    }
  });

  if (!isActive) return null;

  return (
    <Sphere ref={pulseRef} args={[2.5, 32, 32]}>
      <meshBasicMaterial color="#ff2a2a" transparent opacity={0.2} wireframe />
    </Sphere>
  );
}

function BreathingCore({ intensity }) {
  const coreRef = useRef();
  
  useFrame((state) => {
    if (coreRef.current) {
      const breath = 1 + Math.sin(state.clock.elapsedTime * 1.5) * 0.03 * intensity;
      coreRef.current.scale.set(breath, breath, breath);
    }
  });

  return (
    <group ref={coreRef}>
      <Octahedron args={[1.2, 1]}>
        <meshBasicMaterial color="#05070f" wireframe={true} />
      </Octahedron>
      <Octahedron args={[1.18, 1]}>
        <meshBasicMaterial color="#0a1120" />
      </Octahedron>
    </group>
  );
}

function AnimatedRings({ halo1Ref, halo2Ref, isSpeaking, isTyping }) {
  const innerRingRef = useRef();
  
  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;
    
    if (halo1Ref.current) {
      const speed1 = isSpeaking ? 3 : isTyping ? 1.5 : 0.5;
      halo1Ref.current.rotation.x += delta * speed1;
      halo1Ref.current.rotation.y += delta * speed1 * 0.5;
      
      const pulse1 = 1 + Math.sin(time * (isSpeaking ? 5 : 2)) * 0.05;
      halo1Ref.current.scale.set(pulse1, pulse1, 1);
    }

    if (halo2Ref.current) {
      const speed2 = isSpeaking ? -2.5 : isTyping ? -1 : -0.3;
      halo2Ref.current.rotation.y += delta * speed2;
      halo2Ref.current.rotation.z += delta * speed2 * 0.8;
      
      const pulse2 = 1 + Math.sin(time * (isSpeaking ? 4 : 1.5) + 1) * 0.05;
      halo2Ref.current.scale.set(pulse2, 1, pulse2);
    }

    if (innerRingRef.current) {
      const innerSpeed = isSpeaking ? 4 : isTyping ? 2 : 0.8;
      innerRingRef.current.rotation.x += delta * innerSpeed * 0.7;
      innerRingRef.current.rotation.z += delta * innerSpeed * 0.3;
    }
  });

  const haloColor1 = isSpeaking ? '#ff2a2a' : isTyping ? '#ff9000' : '#00f0ff';
  const haloColor2 = isSpeaking ? '#ff9000' : isTyping ? '#00f0ff' : '#1e3a8a';
  const innerColor = isSpeaking ? '#ff5050' : isTyping ? '#ffaa00' : '#00aaff';

  return (
    <>
      <group ref={halo1Ref}>
        <Torus args={[1.8, 0.02, 16, 100]}>
          <meshBasicMaterial color={haloColor1} />
        </Torus>
        <Torus args={[1.85, 0.06, 16, 100]}>
          <meshBasicMaterial color={haloColor1} transparent opacity={0.15} />
        </Torus>
      </group>

      <group ref={halo2Ref}>
        <Torus args={[2.0, 0.02, 16, 100]} rotation={[Math.PI / 2, 0, 0]}>
          <meshBasicMaterial color={haloColor2} />
        </Torus>
        <Torus args={[2.05, 0.04, 16, 100]} rotation={[Math.PI / 2, 0, 0]}>
          <meshBasicMaterial color={haloColor2} transparent opacity={0.15} />
        </Torus>
      </group>

      <group ref={innerRingRef}>
        <Torus args={[1.5, 0.015, 16, 80]} rotation={[Math.PI / 4, Math.PI / 4, 0]}>
          <meshBasicMaterial color={innerColor} transparent opacity={0.6} />
        </Torus>
      </group>
    </>
  );
}

export function Avatar3DAssistant({ isTyping, isSpeaking }) {
  const groupRef = useRef();
  const coreRef = useRef();
  const faceGroupRef = useRef();
  const leftEyeRef = useRef();
  const rightEyeRef = useRef();
  const leftPupilRef = useRef();
  const rightPupilRef = useRef();
  const visorRef = useRef();
  const halo1Ref = useRef();
  const halo2Ref = useRef();
  
  const [blinkProgress, setBlinkProgress] = useState(0);
  const [visorGlow, setVisorGlow] = useState(0);
  const nextBlinkTime = useRef(3000);

  useEffect(() => {
    nextBlinkTime.current = performance.now() + Math.random() * 4000 + 1000;
  }, []);

  const currentLookAt = useRef(new THREE.Vector3(0, 0, 1));
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 1));
  const smoothBobY = useRef(0);
  const smoothScale = useRef(1);

  const eyeColorNormal = '#00f0ff';
  const eyeColorActive = '#ff2a2a';
  
  const eyeMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: eyeColorNormal }), []);
  const typingEyeMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ff9000' }), []);
  const speakingEyeMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: eyeColorActive }), []);
  const pupilMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: "#000" }), []);
  
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
    const time = state.clock.elapsedTime;
    
    // Core rotation with wobble
    if (coreRef.current) {
      const wobble = isSpeaking ? Math.sin(time * 10) * 0.1 : 0;
      coreRef.current.rotation.y -= delta * (isSpeaking ? 1 : isTyping ? 0.5 : 0.2) + wobble * delta;
      coreRef.current.rotation.x = Math.sin(time * 0.5) * 0.05;
    }

    // Eye tracking
    targetLookAt.current.set(pointer.x * 0.8, pointer.y * 0.8, 1).normalize();

    if (isTyping) {
      targetLookAt.current.set(Math.sin(time * 4) * 0.2, 0.2, 1).normalize();
    }

    currentLookAt.current.lerp(targetLookAt.current, 0.1);
    if (faceGroupRef.current) {
      faceGroupRef.current.lookAt(
        currentLookAt.current.x * 2.5,
        currentLookAt.current.y * 2.5,
        currentLookAt.current.z * 2.5
      );
    }

    // Blinking with natural variation
    if (time * 1000 > nextBlinkTime.current) {
      setBlinkProgress(1); 
      nextBlinkTime.current = time * 1000 + Math.random() * 3000 + 1500;
    }

    if (blinkProgress > 0) {
      setBlinkProgress(Math.max(0, blinkProgress - delta * 8)); 
    }
    
    const eyeScaleY = blinkProgress > 0.5 ? (1 - blinkProgress) * 2 : blinkProgress * 2;
    const finalEyeScale = Math.max(0.05, 1 - eyeScaleY);

    if (leftEyeRef.current) leftEyeRef.current.scale.set(1, finalEyeScale, 1);
    if (rightEyeRef.current) rightEyeRef.current.scale.set(1, finalEyeScale, 1);

    // Pupil dilation based on state
    if (leftPupilRef.current && rightPupilRef.current) {
      const dilation = isSpeaking ? 1.5 : isTyping ? 1.2 : 1;
      const pulse = 1 + Math.sin(time * 3) * 0.1;
      const scale = dilation * pulse;
      leftPupilRef.current.scale.set(scale, scale, 1);
      rightPupilRef.current.scale.set(scale, scale, 1);
    }

    // Breathing bob
    if (isSpeaking) {
      const bob = Math.sin(time * 20) * 0.05;
      const breathe = Math.sin(time * 8) * 0.02;
      smoothBobY.current = THREE.MathUtils.lerp(smoothBobY.current, bob, 0.3);
      smoothScale.current = THREE.MathUtils.lerp(smoothScale.current, 1 + breathe, 0.2);
    } else if (isTyping) {
      const bob = Math.sin(time * 6) * 0.02;
      smoothBobY.current = THREE.MathUtils.lerp(smoothBobY.current, bob, 0.15);
      smoothScale.current = THREE.MathUtils.lerp(smoothScale.current, 1, 0.1);
    } else {
      smoothBobY.current = THREE.MathUtils.lerp(smoothBobY.current, Math.sin(time * 1.5) * 0.01, 0.05);
      smoothScale.current = THREE.MathUtils.lerp(smoothScale.current, 1 + Math.sin(time * 1.5) * 0.01, 0.05);
    }

    if (groupRef.current) {
      groupRef.current.position.y = smoothBobY.current;
      groupRef.current.scale.set(smoothScale.current, smoothScale.current, smoothScale.current);
    }

    // Visor glow pulse
    setVisorGlow(Math.sin(time * (isSpeaking ? 6 : 3)) * 0.5 + 0.5);
  });

  const currentEyeMaterial = isSpeaking ? speakingEyeMaterial : isTyping ? typingEyeMaterial : eyeMaterial;
  const visorGlowColor = isSpeaking ? '#ff2a2a' : isTyping ? '#ff9000' : '#00f0ff';

  return (
    <Float speed={1.5} rotationIntensity={0.05} floatIntensity={0.3}>
      <group ref={groupRef}>
        <ParticleField isActive={isSpeaking} />
        <EnergyPulse isActive={isSpeaking} />
        
        <group ref={coreRef}>
          <BreathingCore intensity={isSpeaking ? 1.5 : isTyping ? 1 : 0.5} />
          <Sphere args={[0.4, 16, 16]}>
            <meshBasicMaterial color={visorGlowColor} opacity={isSpeaking ? 0.9 : 0.5} transparent />
          </Sphere>
        </group>

        <AnimatedRings 
          halo1Ref={halo1Ref} 
          halo2Ref={halo2Ref}
          isSpeaking={isSpeaking}
          isTyping={isTyping}
        />

        <group ref={halo1Ref}>
          <Torus args={[1.8, 0.02, 16, 100]}>
            <meshBasicMaterial color={visorGlowColor} />
          </Torus>
          <Torus args={[1.85, 0.06, 16, 100]}>
            <meshBasicMaterial color={visorGlowColor} transparent opacity={0.15} />
          </Torus>
        </group>

        <group ref={halo2Ref}>
          <Torus args={[2.0, 0.02, 16, 100]} rotation={[Math.PI / 2, 0, 0]}>
            <meshBasicMaterial color={visorGlowColor} />
          </Torus>
          <Torus args={[2.05, 0.04, 16, 100]} rotation={[Math.PI / 2, 0, 0]}>
            <meshBasicMaterial color={visorGlowColor} transparent opacity={0.15} />
          </Torus>
        </group>

        <group ref={faceGroupRef}>
          <mesh ref={visorRef} position={[0, 0.2, 1.05]} scale={[0.8, 0.25, 0.05]}>
            <boxGeometry />
            <meshBasicMaterial color="#000" opacity={0.85} transparent />
          </mesh>
          
          <mesh position={[0, 0.2, 1.03]} scale={[0.82, 0.27, 0.02]}>
            <boxGeometry />
            <meshBasicMaterial color={visorGlowColor} opacity={visorGlow * 0.3} transparent />
          </mesh>

          <mesh ref={leftEyeRef} position={[-0.2, 0.2, 1.1]} scale={[0.15, 0.05, 0.05]}>
            <boxGeometry />
            <primitive object={currentEyeMaterial} attach="material" />
            <pointLight distance={2.5} intensity={isSpeaking ? 2.5 : 1.2} color={currentEyeMaterial.color} />
          </mesh>
          
          <mesh ref={leftPupilRef} position={[-0.2, 0.2, 1.13]} scale={[0.06, 0.03, 0.02]}>
            <boxGeometry />
            <primitive object={pupilMaterial} attach="material" />
          </mesh>

          <mesh ref={rightEyeRef} position={[0.2, 0.2, 1.1]} scale={[0.15, 0.05, 0.05]}>
            <boxGeometry />
            <primitive object={currentEyeMaterial} attach="material" />
            <pointLight distance={2.5} intensity={isSpeaking ? 2.5 : 1.2} color={currentEyeMaterial.color} />
          </mesh>
          
          <mesh ref={rightPupilRef} position={[0.2, 0.2, 1.13]} scale={[0.06, 0.03, 0.02]}>
            <boxGeometry />
            <primitive object={pupilMaterial} attach="material" />
          </mesh>

          {isSpeaking && (
            <group position={[0, -0.1, 1.05]}>
              <mesh scale={[0.5, 0.015, 0.03]}>
                <boxGeometry />
                <meshBasicMaterial color="#ff2a2a" />
              </mesh>
              <mesh scale={[0.25, 0.04, 0.04]} position={[0, 0, 0]}>
                <boxGeometry />
                <meshBasicMaterial color="#ff5050" />
              </mesh>
            </group>
          )}
          
          {isTyping && !isSpeaking && (
            <group position={[0, -0.1, 1.05]}>
              {[...Array(5)].map((_, i) => (
                <mesh 
                  key={i}
                  position={[(i - 2) * 0.1, 0, 0]}
                  scale={[0.03, 0.02, 0.02]}
                >
                  <boxGeometry />
                  <meshBasicMaterial color="#ff9000" opacity={0.5 + Math.random() * 0.5} transparent />
                </mesh>
              ))}
            </group>
          )}
        </group>
      </group>
    </Float>
  );
}
