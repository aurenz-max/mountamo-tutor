'use client';

import React from 'react';

export interface ObjectItem {
  name: string;
  count: number;
  icon?: string;
  attributes?: string[];
}

export interface ObjectCollectionData {
  instruction?: string;
  items: ObjectItem[];
  layout?: 'grid' | 'scattered' | 'row';
}

interface ObjectCollectionProps {
  data: ObjectCollectionData;
}

export const ObjectCollection: React.FC<ObjectCollectionProps> = ({ data }) => {
  const { instruction, items, layout = 'grid' } = data;

  const layoutStyles = {
    grid: 'grid grid-cols-5 gap-4 justify-items-center',
    row: 'flex flex-wrap gap-4 justify-center',
    scattered: 'flex flex-wrap gap-6 justify-center items-center'
  };

  const renderObjects = (item: ObjectItem) => {
    const objects = [];
    for (let i = 0; i < item.count; i++) {
      const key = `${item.name}-${i}`;
      objects.push(
        <div
          key={key}
          className="flex flex-col items-center gap-2 p-2 animate-fade-in"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          {/* Object Icon/Emoji */}
          <div className="text-5xl drop-shadow-lg transform transition-transform hover:scale-110">
            {item.icon || '●'}
          </div>

          {/* Optional attributes display */}
          {item.attributes && item.attributes.length > 0 && (
            <div className="text-xs text-slate-400 text-center">
              {item.attributes.join(', ')}
            </div>
          )}
        </div>
      );
    }
    return objects;
  };

  return (
    <div className="w-full my-6 animate-fade-in-up">
      <div className="glass-panel rounded-2xl p-6 border border-white/10">
        {/* Optional instruction text */}
        {instruction && (
          <div className="mb-6 text-center">
            <p className="text-lg text-slate-200 font-light leading-relaxed">
              {instruction}
            </p>
          </div>
        )}

        {/* Objects display */}
        <div className={layoutStyles[layout]}>
          {items.map((item, idx) => (
            <React.Fragment key={`${item.name}-${idx}`}>
              {renderObjects(item)}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};
