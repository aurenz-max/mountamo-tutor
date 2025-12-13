'use client';

import React, { useRef, useState } from 'react';

interface SpotlightCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  isSelected?: boolean;
  color?: string; // RGB format: "255, 100, 50"
}

/**
 * SpotlightCard Component
 *
 * A beautiful card with glassmorphism and spotlight hover effect.
 * The spotlight follows the mouse cursor creating an elegant interactive experience.
 */
export const SpotlightCard: React.FC<SpotlightCardProps> = ({
  children,
  className = "",
  onClick,
  isSelected = false,
  color = "120, 119, 198" // Default purple-ish
}) => {
  const divRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return;

    const div = divRef.current;
    const rect = div.getBoundingClientRect();

    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMouseEnter = () => setOpacity(1);
  const handleMouseLeave = () => setOpacity(0);

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      className={`relative rounded-xl border transition-all duration-300 overflow-hidden cursor-pointer group ${
        isSelected
          ? 'border-white/40 shadow-[0_0_30px_-5px_rgba(var(--glow-color),0.4)] scale-[1.02]'
          : 'border-white/10 hover:border-white/20'
      } ${className}`}
      style={{
        // @ts-ignore - CSS custom properties
        '--glow-color': color,
      }}
    >
      {/* Spotlight Effect Gradient - Follows mouse */}
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          opacity,
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(var(--glow-color), 0.15), transparent 40%)`,
        }}
      />

      {/* Border Glow - Creates the glowing border effect */}
      <div
        className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          opacity,
          background: `radial-gradient(400px circle at ${position.x}px ${position.y}px, rgba(var(--glow-color), 0.4), transparent 40%)`,
          maskImage: 'linear-gradient(black, black) content-box, linear-gradient(black, black)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          padding: '1px' // Width of the border glow
        }}
      />

      {/* Content */}
      <div className="relative h-full">
        {children}
      </div>
    </div>
  );
};

export default SpotlightCard;
