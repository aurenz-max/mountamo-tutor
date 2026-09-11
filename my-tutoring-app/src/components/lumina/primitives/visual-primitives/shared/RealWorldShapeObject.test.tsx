import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RealWorldShapeObject } from './RealWorldShapeObject';
import {
  objectLabelLeaksShape,
  REAL_WORLD_SHAPE_OBJECTS,
} from './realWorldShapeObjects';

describe('RealWorldShapeObject', () => {
  it.each(REAL_WORLD_SHAPE_OBJECTS)(
    'draws exactly one labelled object for $id without printing $shape',
    (object) => {
      const markup = renderToStaticMarkup(
        <RealWorldShapeObject objectId={object.id} />,
      );

      expect(markup.match(/<svg\b/g)).toHaveLength(1);
      expect(markup.match(/<figcaption\b/g)).toHaveLength(1);
      expect(markup).toContain(`aria-label="${object.label}"`);
      expect(markup).toContain(`>${object.label}</figcaption>`);
      expect(objectLabelLeaksShape(object.label)).toBe(false);
    },
  );
});
