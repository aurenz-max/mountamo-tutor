import React from 'react';
import {
  realWorldShapeObjectById,
  type RealWorldShapeObjectId,
} from './realWorldShapeObjects';

interface RealWorldShapeObjectProps {
  objectId: RealWorldShapeObjectId;
  className?: string;
  showLabel?: boolean;
  muted?: boolean;
}

/** Code-drawn familiar objects with one dominant, defensible 2D outline. */
export const RealWorldShapeObject: React.FC<RealWorldShapeObjectProps> = ({
  objectId,
  className = 'h-44 w-44',
  showLabel = true,
  muted = false,
}) => {
  const spec = realWorldShapeObjectById(objectId);
  if (!spec) return null;

  const common = {
    fill: 'rgba(34,211,238,0.16)',
    stroke: '#67e8f9',
    strokeWidth: 6,
    strokeLinejoin: 'round' as const,
  };

  return (
    <figure className={`flex flex-col items-center ${muted ? 'opacity-25' : ''}`}>
      <svg
        viewBox="0 0 200 200"
        className={className}
        role="img"
        aria-label={spec.label}
      >
        {objectId === 'clock' && (
          <>
            <circle cx="100" cy="100" r="78" {...common} />
            {[0, 1, 2, 3].map((turn) => (
              <line
                key={turn}
                x1="100" y1="31" x2="100" y2="43"
                stroke="#f8fafc" strokeWidth="5" strokeLinecap="round"
                transform={`rotate(${turn * 90} 100 100)`}
              />
            ))}
            <line x1="100" y1="100" x2="100" y2="58" stroke="#f8fafc" strokeWidth="6" strokeLinecap="round" />
            <line x1="100" y1="100" x2="135" y2="118" stroke="#f8fafc" strokeWidth="6" strokeLinecap="round" />
            <circle cx="100" cy="100" r="6" fill="#f8fafc" />
          </>
        )}
        {objectId === 'door' && (
          <>
            <rect x="48" y="14" width="104" height="172" rx="3" {...common} />
            <rect x="62" y="29" width="76" height="58" rx="2" fill="none" stroke="#67e8f9" strokeWidth="3" />
            <circle cx="130" cy="112" r="7" fill="#fbbf24" />
          </>
        )}
        {objectId === 'yield-sign' && (
          <>
            <polygon points="16,28 184,28 100,184" {...common} />
            <polygon points="43,49 157,49 100,154" fill="none" stroke="#f8fafc" strokeWidth="5" strokeLinejoin="round" />
          </>
        )}
        {objectId === 'window' && (
          <>
            <rect x="24" y="24" width="152" height="152" {...common} />
            <line x1="100" y1="28" x2="100" y2="172" stroke="#f8fafc" strokeWidth="5" />
            <line x1="28" y1="100" x2="172" y2="100" stroke="#f8fafc" strokeWidth="5" />
          </>
        )}
        {objectId === 'kite' && (
          <>
            <polygon points="100,12 176,88 100,176 24,88" {...common} />
            <line x1="100" y1="18" x2="100" y2="170" stroke="#f8fafc" strokeWidth="3" />
            <line x1="29" y1="88" x2="171" y2="88" stroke="#f8fafc" strokeWidth="3" />
          </>
        )}
        {objectId === 'egg' && (
          <>
            <ellipse cx="100" cy="105" rx="62" ry="82" {...common} />
            <circle cx="78" cy="85" r="8" fill="rgba(248,250,252,0.28)" />
            <circle cx="117" cy="123" r="6" fill="rgba(248,250,252,0.22)" />
          </>
        )}
      </svg>
      {showLabel && (
        <figcaption className="mt-1 text-lg font-semibold text-slate-100">
          {spec.label}
        </figcaption>
      )}
    </figure>
  );
};

export default RealWorldShapeObject;
