'use client';

import React, { useEffect, useRef } from 'react';

interface GenerativeBackgroundProps {
  color: string;
  intensity?: number;
}

type Rgb = { r: number; g: number; b: number };

type Particle = {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  alpha: number;
  phase: number;
};

const BASE_COLOR = '#0f172a';
const INDIGO: Rgb = { r: 99, g: 102, b: 241 };
const CYAN: Rgb = { r: 34, g: 211, b: 238 };
const VIOLET: Rgb = { r: 139, g: 92, b: 246 };

const parseHex = (hex: string): Rgb => {
  const value = hex.replace('#', '');
  const normalized = value.length === 3
    ? value.split('').map(character => character + character).join('')
    : value;
  const match = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(normalized);

  return match
    ? {
        r: parseInt(match[1], 16),
        g: parseInt(match[2], 16),
        b: parseInt(match[3], 16),
      }
    : { r: 71, g: 85, b: 105 };
};

const mix = (first: Rgb, second: Rgb, amount: number): Rgb => ({
  r: Math.round(first.r + (second.r - first.r) * amount),
  g: Math.round(first.g + (second.g - first.g) * amount),
  b: Math.round(first.b + (second.b - first.b) * amount),
});

const rgba = ({ r, g, b }: Rgb, alpha: number) =>
  `rgba(${r}, ${g}, ${b}, ${alpha})`;

export const GenerativeBackground: React.FC<GenerativeBackgroundProps> = ({
  color,
  intensity = 0.5,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const strength = Math.min(1, Math.max(0, intensity));
    const theme = parseHex(color);
    const primary = mix(theme, INDIGO, 0.38);
    const secondary = mix(theme, CYAN, 0.58);
    const tertiary = mix(theme, VIOLET, 0.52);

    let animationFrameId = 0;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let lastTime = 0;
    let lastPaintTime = 0;
    let particles: Particle[] = [];

    const createParticles = () => {
      // Scale gently with screen area without turning large displays into star fields.
      const count = Math.min(48, Math.max(24, Math.round((width * height) / 42000)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 1.8 + 0.6,
        speedX: (Math.random() - 0.5) * 3.5,
        speedY: (Math.random() - 0.5) * 3.5,
        alpha: Math.random() * 0.22 + 0.08,
        phase: Math.random() * Math.PI * 2,
      }));
    };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      createParticles();
    };

    const drawGlow = (
      x: number,
      y: number,
      radiusX: number,
      radiusY: number,
      rotation: number,
      glowColor: Rgb,
      alpha: number,
    ) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.scale(1, radiusY / radiusX);
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radiusX);
      gradient.addColorStop(0, rgba(glowColor, alpha));
      gradient.addColorStop(0.42, rgba(glowColor, alpha * 0.42));
      gradient.addColorStop(1, rgba(glowColor, 0));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, radiusX, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const draw = (time = 0) => {
      // The atmosphere moves very slowly; 30fps is visually identical here and
      // avoids spending a full 60fps repainting a viewport-sized canvas.
      if (!motionQuery.matches && time && time - lastPaintTime < 1000 / 30) {
        animationFrameId = requestAnimationFrame(draw);
        return;
      }

      const elapsed = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
      lastTime = time;
      lastPaintTime = time;
      const drift = motionQuery.matches ? 0 : time * 0.000035;
      const span = Math.max(width, height);

      ctx.fillStyle = BASE_COLOR;
      ctx.fillRect(0, 0, width, height);

      // Offset, overlapping blooms feel atmospheric instead of forming a target
      // around the exact center of the page.
      drawGlow(
        width * (0.2 + Math.sin(drift) * 0.035),
        height * (0.18 + Math.cos(drift * 0.8) * 0.025),
        span * 0.72,
        span * 0.46,
        -0.18,
        primary,
        0.12 * strength,
      );
      drawGlow(
        width * (0.84 + Math.cos(drift * 0.7) * 0.025),
        height * (0.42 + Math.sin(drift * 0.9) * 0.04),
        span * 0.58,
        span * 0.38,
        0.28,
        secondary,
        0.075 * strength,
      );
      drawGlow(
        width * (0.5 + Math.sin(drift * 0.55) * 0.05),
        height * 1.04,
        span * 0.68,
        span * 0.32,
        -0.08,
        tertiary,
        0.07 * strength,
      );

      // Sparse connections suggest a constellation without competing with content.
      ctx.lineWidth = 0.65;
      for (let first = 0; first < particles.length; first += 1) {
        const particle = particles[first];
        if (!motionQuery.matches) {
          particle.x += particle.speedX * elapsed;
          particle.y += particle.speedY * elapsed;

          if (particle.x < -8) particle.x = width + 8;
          if (particle.x > width + 8) particle.x = -8;
          if (particle.y < -8) particle.y = height + 8;
          if (particle.y > height + 8) particle.y = -8;
        }

        for (let second = first + 1; second < particles.length; second += 1) {
          const neighbor = particles[second];
          const distance = Math.hypot(particle.x - neighbor.x, particle.y - neighbor.y);
          if (distance > 115) continue;

          ctx.beginPath();
          ctx.moveTo(particle.x, particle.y);
          ctx.lineTo(neighbor.x, neighbor.y);
          ctx.strokeStyle = rgba(secondary, (1 - distance / 115) * 0.055 * strength);
          ctx.stroke();
        }

        const twinkle = motionQuery.matches ? 1 : 0.82 + Math.sin(time * 0.0007 + particle.phase) * 0.18;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = rgba(mix(theme, CYAN, 0.32), particle.alpha * twinkle * (0.5 + strength * 0.5));
        ctx.fill();
      }

      // Darken the edges with straight gradients; no circular vignette to reintroduce rings.
      const topShade = ctx.createLinearGradient(0, 0, 0, height);
      topShade.addColorStop(0, 'rgba(2, 6, 23, 0.08)');
      topShade.addColorStop(0.55, 'rgba(2, 6, 23, 0)');
      topShade.addColorStop(1, 'rgba(2, 6, 23, 0.24)');
      ctx.fillStyle = topShade;
      ctx.fillRect(0, 0, width, height);

      const sideShade = ctx.createLinearGradient(0, 0, width, 0);
      sideShade.addColorStop(0, 'rgba(2, 6, 23, 0.18)');
      sideShade.addColorStop(0.22, 'rgba(2, 6, 23, 0)');
      sideShade.addColorStop(0.78, 'rgba(2, 6, 23, 0)');
      sideShade.addColorStop(1, 'rgba(2, 6, 23, 0.18)');
      ctx.fillStyle = sideShade;
      ctx.fillRect(0, 0, width, height);

      if (!motionQuery.matches) {
        animationFrameId = requestAnimationFrame(draw);
      }
    };

    const handleMotionPreference = () => {
      cancelAnimationFrame(animationFrameId);
      lastTime = 0;
      lastPaintTime = 0;
      draw();
    };

    window.addEventListener('resize', resize);
    motionQuery.addEventListener('change', handleMotionPreference);
    resize();
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      motionQuery.removeEventListener('change', handleMotionPreference);
      cancelAnimationFrame(animationFrameId);
    };
  }, [color, intensity]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full transition-colors duration-1000 ease-in-out"
    />
  );
};
