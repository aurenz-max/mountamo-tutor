'use client';

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { LuminaCard, LuminaCardContent, LuminaReadAloud } from '../../../../../ui';
import { SoundManager } from '../../../../../utils/SoundManager';
import {
  layoutParagraphsAroundFigure,
  layoutBalancedColumns,
  layoutMasonryCards,
  clearPrepareCache,
  EDITORIAL_FONT,
  EDITORIAL_LINE_HEIGHT,
  PARAGRAPH_GAP,
  type LayoutLineWithPosition,
  type FigureRect,
  type ColumnLayout,
  type MasonryLayout,
  type MasonryCard,
} from '../../../../../utils/editorial-layout';
import type { ProseBlockData } from '../types';
import BlockTutorHelp from './BlockTutorHelp';

// ── Constants ────────────────────────────────────────────────────────

const FIGURE_GAP = 20;
const COLUMN_THRESHOLD = 600;
const COLUMN_TEXT_THRESHOLD = 300;
const MASONRY_MIN_PARAGRAPHS = 3;
const FONT_STYLE = { fontFamily: 'Inter, Helvetica, Arial, sans-serif' };

interface ProseBlockProps {
  data: ProseBlockData;
  index?: number;
  /** Bridge to the DeepDive live tutor for a spoken walkthrough of the passage. */
  onAskTutor?: (message: string) => void;
  /**
   * Pre-reader (K) presentation — the passage is unreadable to the child, so the
   * read-aloud affordance becomes a single large speaker-first button and the
   * text-labeled discussion button is dropped (reader-fit rules 1, 4, 7).
   */
  preReader?: boolean;
}

// ── Reveal Animation Hook ────────────────────────────────────────────

function useRevealAnimation(enabled: boolean) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [visible, setVisible] = useState(!enabled);

  useEffect(() => {
    if (!enabled) return;
    // Safety net: absolute-positioned renderers (columns/inset/figure) lay out
    // asynchronously, so the ref may attach to a zero-height element and the
    // IntersectionObserver can never fire isIntersecting — leaving the text
    // pinned at opacity:0 forever. Always reveal after a short delay so content
    // can never be permanently hidden, even if the observer path fails.
    const fallback = setTimeout(() => setVisible(true), 600);
    return () => {
      clearTimeout(fallback);
      observerRef.current?.disconnect();
    };
  }, [enabled]);

  const revealRef = useCallback(
    (el: HTMLDivElement | null) => {
      observerRef.current?.disconnect();
      if (!enabled || !el) return;

      // Check if already in view (handles race where element mounts already visible)
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0 && rect.height > 0) {
        setVisible(true);
        return;
      }

      observerRef.current = new IntersectionObserver(
        ([entry]) => { if (entry?.isIntersecting) setVisible(true); },
        { threshold: 0.15 },
      );
      observerRef.current.observe(el);
    },
    [enabled],
  );

  const getLineStyle = useCallback(
    (i: number): React.CSSProperties => {
      if (!enabled) return {};
      return {
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        transition: `opacity 0.4s ease ${i * 0.03}s, transform 0.4s ease ${i * 0.03}s`,
      };
    },
    [enabled, visible],
  );

  return { revealRef, getLineStyle };
}

// ── Positioned Lines Renderer ────────────────────────────────────────

interface PositionedLinesProps {
  lines: LayoutLineWithPosition[];
  lineHeight: number;
  totalHeight: number;
  accessibleText: string;
  reveal?: boolean;
}

const PositionedLines: React.FC<PositionedLinesProps> = ({
  lines,
  lineHeight,
  totalHeight,
  accessibleText,
  reveal = false,
}) => {
  const { revealRef, getLineStyle } = useRevealAnimation(reveal);

  return (
    <div ref={revealRef} className="relative" style={{ minHeight: totalHeight }}>
      <div className="sr-only" aria-live="polite">{accessibleText}</div>

      {lines.map((line, i) => (
        <span
          key={i}
          role="presentation"
          className="absolute text-base text-slate-200"
          style={{
            left: line.x,
            top: line.y,
            lineHeight: `${lineHeight}px`,
            ...FONT_STYLE,
            ...getLineStyle(i),
          }}
        >
          {line.text}
        </span>
      ))}
    </div>
  );
};

// ── Text-Around-Figure Renderer ──────────────────────────────────────

interface FigureRendererProps {
  paragraphs: string[];
  figure: NonNullable<ProseBlockData['figure']>;
  reveal: boolean;
}

const FigureRenderer: React.FC<FigureRendererProps> = ({ paragraphs, figure, reveal }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const figureRef = useRef<HTMLDivElement | null>(null);
  const [lines, setLines] = useState<LayoutLineWithPosition[]>([]);
  const [imageLoaded, setImageLoaded] = useState(false);

  const doLayout = useCallback(() => {
    const container = containerRef.current;
    const figureEl = figureRef.current;
    if (!container || !figureEl) return;

    const containerWidth = container.clientWidth;
    const figureWidth = figureEl.offsetWidth + FIGURE_GAP;
    const figureHeight = figureEl.offsetHeight + FIGURE_GAP;

    if (figureWidth <= FIGURE_GAP || figureHeight <= FIGURE_GAP) return;

    const rect: FigureRect = {
      placement: figure.placement,
      width: figureWidth,
      height: figureHeight,
    };

    const laid = layoutParagraphsAroundFigure(
      paragraphs, EDITORIAL_FONT, containerWidth, rect, EDITORIAL_LINE_HEIGHT, PARAGRAPH_GAP,
    );
    setLines(laid);
  }, [paragraphs, figure.placement, imageLoaded]);

  useEffect(() => {
    doLayout();
    const observer = new ResizeObserver(() => doLayout());
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [doLayout]);

  const totalHeight = lines.length > 0
    ? lines[lines.length - 1].y + EDITORIAL_LINE_HEIGHT
    : 0;

  return (
    <div ref={containerRef} className="relative" style={{ minHeight: totalHeight }}>
      <div
        ref={figureRef}
        className={`absolute top-0 w-2/5 ${
          figure.placement === 'left' ? 'left-0' : 'right-0'
        }`}
      >
        <div className="rounded-lg overflow-hidden border border-white/10">
          <img
            src={figure.imageBase64}
            alt={figure.altText}
            className="w-full h-auto object-cover"
            onLoad={() => setImageLoaded(true)}
          />
        </div>
        {figure.caption && (
          <p className="text-xs text-slate-500 mt-2 italic leading-relaxed">
            {figure.caption}
          </p>
        )}
      </div>

      <PositionedLines
        lines={lines}
        lineHeight={EDITORIAL_LINE_HEIGHT}
        totalHeight={totalHeight}
        accessibleText={paragraphs.join('\n\n')}
        reveal={reveal}
      />
    </div>
  );
};

// ── Inset Facts Renderer ────────────────────────────────────────────

interface InsetFactsRendererProps {
  paragraphs: string[];
  insetFacts: NonNullable<ProseBlockData['insetFacts']>;
  reveal: boolean;
}

const InsetFactsRenderer: React.FC<InsetFactsRendererProps> = ({ paragraphs, insetFacts, reveal }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const insetRef = useRef<HTMLDivElement | null>(null);
  const [lines, setLines] = useState<LayoutLineWithPosition[]>([]);
  const [insetReady, setInsetReady] = useState(false);

  // Measure the inset card once it mounts, then reflow prose around it
  const doLayout = useCallback(() => {
    const container = containerRef.current;
    const insetEl = insetRef.current;
    if (!container || !insetEl) return;

    const containerWidth = container.clientWidth;
    const insetWidth = insetEl.offsetWidth + FIGURE_GAP;
    const insetHeight = insetEl.offsetHeight + FIGURE_GAP;

    if (insetWidth <= FIGURE_GAP || insetHeight <= FIGURE_GAP) return;

    const rect: FigureRect = {
      placement: insetFacts.placement,
      width: insetWidth,
      height: insetHeight,
    };

    const laid = layoutParagraphsAroundFigure(
      paragraphs, EDITORIAL_FONT, containerWidth, rect, EDITORIAL_LINE_HEIGHT, PARAGRAPH_GAP,
    );
    setLines(laid);
  }, [paragraphs, insetFacts.placement, insetReady]);

  useEffect(() => {
    doLayout();
    const observer = new ResizeObserver(() => doLayout());
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [doLayout]);

  // Signal readiness after first paint so layout recalculates with real dimensions
  useEffect(() => {
    if (insetRef.current) {
      requestAnimationFrame(() => setInsetReady(true));
    }
  }, []);

  const totalHeight = lines.length > 0
    ? Math.max(
        lines[lines.length - 1].y + EDITORIAL_LINE_HEIGHT,
        (insetRef.current?.offsetHeight ?? 0),
      )
    : 0;

  return (
    <div ref={containerRef} className="relative" style={{ minHeight: totalHeight }}>
      {/* Inset facts card — positioned like a figure but renders key facts */}
      <div
        ref={insetRef}
        className={`absolute top-0 w-2/5 ${
          insetFacts.placement === 'left' ? 'left-0' : 'right-0'
        }`}
      >
        <div className="rounded-xl backdrop-blur-md bg-slate-800/60 border border-blue-400/20 p-4 space-y-3">
          <div className="text-[10px] font-mono uppercase tracking-widest text-blue-400/70 mb-2">
            Key Concepts
          </div>
          {insetFacts.facts.map((fact, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="text-lg shrink-0 mt-0.5">{fact.icon}</span>
              <p className="text-sm leading-relaxed text-slate-300">{fact.text}</p>
            </div>
          ))}
        </div>
      </div>

      <PositionedLines
        lines={lines}
        lineHeight={EDITORIAL_LINE_HEIGHT}
        totalHeight={totalHeight}
        accessibleText={paragraphs.join('\n\n')}
        reveal={reveal}
      />
    </div>
  );
};

// ── Multi-Column Renderer ────────────────────────────────────────────

interface ColumnRendererProps {
  paragraphs: string[];
  reveal: boolean;
}

const ColumnRenderer: React.FC<ColumnRendererProps> = ({ paragraphs, reveal }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [columnLayout, setColumnLayout] = useState<ColumnLayout | null>(null);

  const doLayout = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const containerWidth = container.clientWidth;
    const numCols = containerWidth >= 900 ? 3 : 2;

    const result = layoutBalancedColumns(
      paragraphs, EDITORIAL_FONT, containerWidth, numCols,
      EDITORIAL_LINE_HEIGHT, 32, PARAGRAPH_GAP,
    );
    setColumnLayout(result);
  }, [paragraphs]);

  useEffect(() => {
    doLayout();
    const observer = new ResizeObserver(() => doLayout());
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [doLayout]);

  const allLines = columnLayout?.columns.flat() ?? [];
  const totalHeight = columnLayout?.maxColumnHeight ?? 0;

  return (
    <div ref={containerRef}>
      {columnLayout && (
        <PositionedLines
          lines={allLines}
          lineHeight={EDITORIAL_LINE_HEIGHT}
          totalHeight={totalHeight}
          accessibleText={paragraphs.join('\n\n')}
          reveal={reveal}
        />
      )}
    </div>
  );
};

// ── Masonry Card Renderer ────────────────────────────────────────────

interface MasonryRendererProps {
  paragraphs: string[];
  reveal: boolean;
}

const MasonryRenderer: React.FC<MasonryRendererProps> = ({ paragraphs, reveal }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [masonry, setMasonry] = useState<MasonryLayout | null>(null);

  const doLayout = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const containerWidth = container.clientWidth;
    const numCols = containerWidth >= 700 ? 3 : containerWidth >= 450 ? 2 : 1;

    const result = layoutMasonryCards(
      paragraphs,
      EDITORIAL_FONT,
      containerWidth,
      numCols,
      16, // columnGap
      16, // rowGap
      20, // cardPadding
      EDITORIAL_LINE_HEIGHT,
    );
    setMasonry(result);
  }, [paragraphs]);

  useEffect(() => {
    doLayout();
    const observer = new ResizeObserver(() => doLayout());
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [doLayout]);

  const { revealRef, getLineStyle } = useRevealAnimation(reveal);

  // Merge the layout ref and reveal ref via callback
  const mergedRef = useCallback(
    (el: HTMLDivElement | null) => {
      (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
      revealRef(el);
    },
    [revealRef],
  );

  return (
    <div ref={mergedRef} className="relative" style={{ minHeight: masonry?.totalHeight ?? 0 }}>
      <div className="sr-only" aria-live="polite">{paragraphs.join('\n\n')}</div>

      {masonry?.cards.map((card: MasonryCard, i: number) => (
        <div
          key={i}
          className="absolute rounded-xl backdrop-blur-md bg-white/5 border border-white/10 p-5"
          style={{
            left: card.x,
            top: card.y,
            width: card.width,
            minHeight: card.contentHeight + 40,
            ...getLineStyle(i),
          }}
        >
          <p
            className="text-sm leading-relaxed text-slate-300"
            style={FONT_STYLE}
          >
            {card.text}
          </p>
        </div>
      ))}
    </div>
  );
};

// ── Simple Prose (CSS path) ──────────────────────────────────────────

interface SimpleProseProps {
  paragraphs: string[];
  showDropCap?: boolean;
  reveal: boolean;
}

const SimpleProse: React.FC<SimpleProseProps> = ({ paragraphs, showDropCap = true, reveal }) => {
  const { revealRef, getLineStyle } = useRevealAnimation(reveal);

  return (
    <div ref={revealRef}>
      {paragraphs.map((paragraph, i) => (
        <p
          key={i}
          className={`text-base leading-relaxed text-slate-200 mb-4 last:mb-0 ${
            i === 0 && showDropCap
              ? 'first-letter:text-3xl first-letter:font-bold first-letter:text-slate-100 first-letter:float-left first-letter:mr-1 first-letter:leading-none'
              : ''
          }`}
          style={{ ...FONT_STYLE, ...getLineStyle(i) }}
        >
          {paragraph}
        </p>
      ))}
    </div>
  );
};

// ── Main Component ───────────────────────────────────────────────────

const ProseBlock: React.FC<ProseBlockProps> = ({ data, index, onAskTutor, preReader = false }) => {
  const { paragraphs, figure, insetFacts, label, layout: layoutMode, reveal = false } = data;
  const hasFigure = !!figure?.imageBase64;
  const hasInsetFacts = !!insetFacts?.facts?.length;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      setContainerWidth(entries[0]?.contentRect.width ?? 0);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => clearPrepareCache(), []);

  const resolvedLayout = useMemo(() => {
    if (layoutMode === 'masonry' && paragraphs.length >= MASONRY_MIN_PARAGRAPHS) return 'masonry';
    if (layoutMode === 'columns') return 'columns';
    if (hasInsetFacts) return 'inset-facts';
    if (hasFigure) return 'flow';
    // Don't auto-switch to columns when reveal is enabled — the reveal animation
    // is designed for paragraph-level fading (SimpleProse), not absolute-positioned
    // Pretext lines which have timing issues with IntersectionObserver.
    if (reveal) return 'flow';
    const totalChars = paragraphs.join('').length;
    if (containerWidth >= COLUMN_THRESHOLD && totalChars >= COLUMN_TEXT_THRESHOLD && paragraphs.length >= 2) {
      return 'columns';
    }
    return 'flow';
  }, [layoutMode, paragraphs, hasFigure, hasInsetFacts, containerWidth, reveal]);

  return (
    <LuminaCard
      data-block-index={index}
      className="shadow-lg overflow-hidden"
    >
      <LuminaCardContent className="p-6" ref={containerRef}>
        {label && (
          <div className="text-xs font-mono uppercase tracking-widest text-slate-500 mb-4">
            {label}
          </div>
        )}

        {/* NOTE: `reveal` (line-by-line fade-in) is ONLY safe for SimpleProse.
            The absolute-positioned renderers (masonry/columns/inset-facts/figure)
            lay out asynchronously in two passes, so the reveal IntersectionObserver
            attaches to a zero-height element and `visible` can never flip — leaving
            a tall, blank card. Always paint those at full opacity. */}
        {resolvedLayout === 'masonry' ? (
          <MasonryRenderer paragraphs={paragraphs} reveal={false} />
        ) : resolvedLayout === 'columns' ? (
          <ColumnRenderer paragraphs={paragraphs} reveal={false} />
        ) : resolvedLayout === 'inset-facts' ? (
          <InsetFactsRenderer paragraphs={paragraphs} insetFacts={insetFacts!} reveal={false} />
        ) : hasFigure ? (
          <FigureRenderer paragraphs={paragraphs} figure={figure!} reveal={false} />
        ) : (
          <SimpleProse paragraphs={paragraphs} reveal={reveal} />
        )}

        {/* Tutor affordances ride below the content — the positioned-line
            renderers lay out asynchronously, so per-paragraph tap targets
            aren't safe here the way they are in card-based blocks. */}
        {onAskTutor && (preReader ? (
          // Pre-reader: ONE large speaker-first affordance. [BLOCK_READ_ALOUD]
          // is enacted by the catalog PRE-READER READ-ALOUD directive, so the
          // word-for-word read survives the lesson-mode brevity cap.
          <div className="mt-4">
            <LuminaReadAloud
              size="lg"
              label="Read to me"
              onClick={() => {
                SoundManager.tap();
                onAskTutor(`[BLOCK_READ_ALOUD] A pre-reader tapped the speaker on this section${label ? ` ("${label}")` : ''} — they cannot read it. Read the passage aloud to them word for word, warmly and clearly: "${paragraphs.join(' ')}". When you finish reading, stop — no commentary, no questions.`);
              }}
            />
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            <LuminaReadAloud
              size="sm"
              label="Read this section"
              onClick={() => {
                SoundManager.tap();
                onAskTutor(`[READ_SECTION] The student tapped "Read this section"${label ? ` on "${label}"` : ''}. Read this passage aloud to them word for word, in a warm, clear voice: "${paragraphs.join(' ')}". When you finish reading, stop — no commentary, no questions.`);
              }}
            />
            <BlockTutorHelp
              onAskTutor={onAskTutor}
              label="Talk about this with your tutor"
              message={`[PROSE_EXPLORE] The student wants to talk about this passage${label ? ` ("${label}")` : ''}: "${paragraphs.join(' ').slice(0, 700)}". Give the big idea in one friendly sentence, share the most interesting detail, then ask what stood out to them. Keep it short and conversational.`}
            />
          </div>
        ))}
      </LuminaCardContent>
    </LuminaCard>
  );
};

export default ProseBlock;
