import React, { useRef, useEffect, useCallback } from "react";

/**
 * WebcamManager handles discrete frame capture for the perception layer.
 * It is a non-visual component that manages the camera stream internally.
 */
const WebcamManager = ({ socket, isActive }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) return;
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user" 
        } 
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn("Camera access denied or unavailable:", err.message);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const captureFrame = useCallback(() => {
    if (!isActive || !videoRef.current || !canvasRef.current || !streamRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Set canvas dimensions to match video
    if (canvas.width !== video.videoWidth) {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
    }

    const context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Get base64 frame (JPEG for smaller size)
    const frame = canvas.toDataURL("image/jpeg", 0.6);
    
    if (socket?.connected) {
      socket.emit("perception:analyze", { frame: frame.split(",")[1] });
    }
  }, [socket, isActive]);

  useEffect(() => {
    if (isActive) {
      startCamera();
      const interval = setInterval(captureFrame, 10000); // Capture every 10 seconds in background
      return () => {
        clearInterval(interval);
        // We keep camera open while active to avoid "blinking" system indicators
      };
    } else {
      stopCamera();
    }
  }, [isActive, startCamera, stopCamera, captureFrame]);

  return (
    <div style={{ display: "none" }}>
      <video ref={videoRef} autoPlay playsInline muted />
      <canvas ref={canvasRef} />
    </div>
  );
};

export default WebcamManager;
