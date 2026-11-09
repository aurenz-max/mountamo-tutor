'use client';

import React, { useMemo } from 'react';
import { displayHtml, type Display } from './displays';

/**
 * One kit display in a component. Every agent primitive renders displays through this. The `__html` object stays the
 * same between renders: a new one rewrites the picture, and Pip re-renders on pointerdown, so the node under the finger
 * was gone before mouseup and the browser fired no click (a tap on a card's picture did nothing).
 * The host adds `DISPLAY_CSS` once, for all of its displays.
 */
export const KitDisplay: React.FC<{ display: Display; className?: string; altText?: string }> = ({ display, className, altText }) => {
  const html = useMemo(() => ({ __html: displayHtml(display) }), [display]);
  return <div className={className} {...(altText ? { role: 'img', 'aria-label': altText } : {})} dangerouslySetInnerHTML={html} />;
};
