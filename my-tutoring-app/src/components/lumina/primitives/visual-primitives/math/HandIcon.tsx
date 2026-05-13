import React from 'react';

interface HandIconProps {
  fingerCount: 1 | 2 | 3 | 4 | 5;
  size?: number;
  className?: string;
}

const HandIcon: React.FC<HandIconProps> = ({ fingerCount, size = 64, className }) => {
  const palmFill = '#fde7c3';
  const palmStroke = '#c98a52';
  const strokeWidth = 2.5;

  // Each finger is described by base (palm-side) and tip coordinates and a width.
  // Order: pinky, ring, middle, index, thumb. The first `fingerCount` fingers
  // raised are: thumb + index + middle + ring + pinky (in that order for 1..5).
  const fingers = [
    { id: 'thumb',  basePos: { x: 22, y: 78 }, tipPos: { x: 10, y: 60 }, width: 12, raised: true },
    { id: 'index',  basePos: { x: 32, y: 60 }, tipPos: { x: 32, y: 24 }, width: 10, raised: true },
    { id: 'middle', basePos: { x: 46, y: 56 }, tipPos: { x: 46, y: 16 }, width: 10, raised: true },
    { id: 'ring',   basePos: { x: 60, y: 60 }, tipPos: { x: 60, y: 22 }, width: 10, raised: true },
    { id: 'pinky',  basePos: { x: 72, y: 66 }, tipPos: { x: 76, y: 36 }, width: 9,  raised: true },
  ];

  // Pattern of raised fingers per count — uses the universal "show N" gesture:
  // 1 = index, 2 = index+middle, 3 = index+middle+ring, 4 = all four (no thumb), 5 = all.
  const raisedByCount: Record<number, string[]> = {
    1: ['index'],
    2: ['index', 'middle'],
    3: ['index', 'middle', 'ring'],
    4: ['index', 'middle', 'ring', 'pinky'],
    5: ['thumb', 'index', 'middle', 'ring', 'pinky'],
  };
  const raised = new Set(raisedByCount[fingerCount] ?? []);

  // Curled (down) finger renders as a short stub at the palm edge.
  const curledTip = (base: { x: number; y: number }) => ({ x: base.x, y: base.y - 8 });

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label={`${fingerCount} finger${fingerCount === 1 ? '' : 's'} raised`}
    >
      {/* Palm */}
      <ellipse
        cx={50}
        cy={78}
        rx={28}
        ry={18}
        fill={palmFill}
        stroke={palmStroke}
        strokeWidth={strokeWidth}
      />

      {/* Fingers */}
      {fingers.map((f) => {
        const isUp = raised.has(f.id);
        const tip = isUp ? f.tipPos : curledTip(f.basePos);
        return (
          <line
            key={f.id}
            x1={f.basePos.x}
            y1={f.basePos.y}
            x2={tip.x}
            y2={tip.y}
            stroke={palmStroke}
            strokeWidth={f.width}
            strokeLinecap="round"
            fill="none"
          />
        );
      })}

      {/* Palm overlay so finger bases blend in */}
      <ellipse
        cx={50}
        cy={80}
        rx={24}
        ry={12}
        fill={palmFill}
        stroke="none"
      />
    </svg>
  );
};

export default HandIcon;
