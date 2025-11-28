import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  isActive: boolean;
  isSpeaking: boolean; // True if AI is speaking
}

const Visualizer: React.FC<VisualizerProps> = ({ isActive, isSpeaking }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;
    const bars = 20;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;
      const barWidth = width / bars;

      for (let i = 0; i < bars; i++) {
        // Base height
        let barHeight = 5;

        if (isActive) {
          if (isSpeaking) {
             // More active wave for AI
             barHeight = 20 + Math.sin(time * 0.2 + i * 0.5) * 15 + Math.random() * 10;
          } else {
             // Gentle idle wave or listening
             barHeight = 10 + Math.sin(time * 0.1 + i * 0.3) * 5;
          }
        }

        const x = i * barWidth;
        const y = (height - barHeight) / 2;

        ctx.fillStyle = isSpeaking ? '#3b82f6' : '#94a3b8'; // Blue for AI, Slate for idle/user
        ctx.beginPath();
        ctx.roundRect(x + 2, y, barWidth - 4, barHeight, 4);
        ctx.fill();
      }

      time++;
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isActive, isSpeaking]);

  return (
    <canvas 
      ref={canvasRef} 
      width={300} 
      height={100} 
      className="w-full max-w-[300px] h-[100px]"
    />
  );
};

export default Visualizer;