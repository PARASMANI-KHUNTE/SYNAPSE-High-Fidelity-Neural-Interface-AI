import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { Avatar3DAssistant } from './Avatar3D';

export default function AvatarCanvas({ isTyping, isSpeaking, isDockCompressed = false }) {
  if (isDockCompressed) {
    return null;
  }

  return (
    <div
      className="fixed right-0 top-0 bottom-0 pointer-events-none hidden 2xl:block"
      style={{
        width: 'auto',
        minWidth: '300px',
        maxWidth: '380px',
        zIndex: 8,
        opacity: 0.82,
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 4.5], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={1.5} color="#f59e0b" />
        <directionalLight position={[-5, 5, -5]} intensity={1} color="#a855f7" />
        
        <Avatar3DAssistant isTyping={isTyping} isSpeaking={isSpeaking} />
        
        <Environment preset="night" />
      </Canvas>
    </div>
  );
}
