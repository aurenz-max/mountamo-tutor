import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle, XCircle, Info, ArrowLeftRight, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePrimitiveEvaluation, PrimitiveEvaluationResult } from '../../../evaluation';
import type { CompareContrastMetrics } from '../../../evaluation/types';
import { SoundManager } from '../../../utils/SoundManager';
import { LuminaDropZone, LuminaReadAloud, type DropZoneState } from '../../../ui';
import { useLuminaAI } from '../../../hooks/useLuminaAI';

/**
 * Compare & Contrast Viewer - Biology primitive for comparing entities
 *
 * Purpose: Side-by-side (or Venn) comparison of two biological entities—organisms,
 * cells, organs, processes, biomes. The essential "how are these alike and different?" primitive.
 *
 * Grade Band: K-8
 * Cognitive Operation: Compare, contrast, analyze shared vs unique properties
 *
 * Design: Two modes—side-by-side card comparison with aligned attribute rows
 * (highlighted matching/differing values), or interactive Venn diagram where students
 * drag attributes into correct regions (shared, unique-A, unique-B).
 *
 * At K-2 (reader-fit 15A/S5) neither mode was completable by a non-reader: the
 * Venn is drag-only with ~17 text cards, and side-by-side is a silent wall of
 * prose. Both now have a pre-reader path — see `PreReaderCompareView` and the
 * `isPreReader` branches below.
 */

// ============================================================================
// Type Definitions (Single Source of Truth)
// ============================================================================

export interface EntityAttribute {
  category: string;
  value: string;
  isShared: boolean;
}

export interface EntityInfo {
  name: string;
  imagePrompt: string;
  imageUrl?: string; // Generated or provided image URL
  attributes: EntityAttribute[];
}

export interface SharedAttribute {
  category: string;
  value: string;
}

export interface CompareContrastData {
  title: string;
  mode: 'side-by-side' | 'venn-interactive';
  entityA: EntityInfo;
  entityB: EntityInfo;
  sharedAttributes: SharedAttribute[];
  keyInsight: string; // The 'so what' — why this comparison matters
  gradeBand: 'K-2' | '3-5' | '6-8';

  // Evaluation props (optional, auto-injected by ManifestOrderRenderer)
  instanceId?: string;
  skillId?: string;
  subskillId?: string;
  objectiveId?: string;
  exhibitId?: string;
  onEvaluationSubmit?: (result: PrimitiveEvaluationResult<CompareContrastMetrics>) => void;
}

// ============================================================================
// Comparison items — the shared answer key for both interactive paths
// ============================================================================

export type ComparisonRegion = 'A-only' | 'shared' | 'B-only';

export interface ComparisonItem {
  key: string;
  category: string;
  value: string;
  correctRegion: ComparisonRegion;
}

const itemKey = (category: string, value: string) => `${category}: ${value}`;

/**
 * Build the one answer key both the Venn (3-8) and the pre-reader tap task
 * (K-2) score against.
 *
 * This replaces an inline construction that carried two measured defects at
 * EVERY grade (reader-fit 15A/S5):
 *
 * 1. **The B-only region was structurally unreachable.** Entity B's attributes
 *    were filtered with `!entityA.attributes.some(a => a.category === b.category)`,
 *    while the generator prompt explicitly instructs "Use the SAME categories as
 *    Entity A where comparing the same aspect". The two rules cancel: probed at
 *    K, G1 and G4, entity B contributed **0 cards on all three draws**, so one
 *    of the three Venn regions was never correct for anything. That also makes
 *    the K-2 three-target tap task impossible, which is why this is fixed here
 *    rather than filed.
 *
 * 2. **The answer key could contradict itself.** A shared attribute was emitted
 *    both as an entity-A card (`correctRegion: 'A-only'`) and as a shared card
 *    (`'shared'`). Placements are keyed on `category: value`, so when those
 *    strings matched, one identical card carried two different correct answers
 *    and a perfect player was capped below 100%. Run the generator's OWN K-2
 *    example (Dog vs Cat) through the old builder and the ceiling is **60%**.
 *    It stayed hidden on the three live draws only because Gemini wrote longer,
 *    distinct prose for the shared entries — the shorter the values, the likelier
 *    it fires, i.e. it fires hardest at the youngest band.
 *
 * The rule here is deliberately narrow: identical text cannot carry two
 * different answers. An attribute resolves to 'shared' when its (category, value)
 * matches a shared attribute, or when both entities state it identically — the
 * same notion `SideBySideView` already used to tint a row emerald. `isShared` is
 * NOT trusted as a region signal on its own, because its value is often
 * entity-specific prose ("Vertebrate mammal belonging to the canine family"),
 * which would be wrong in the middle of a Venn.
 */
export const buildComparisonItems = (data: CompareContrastData): ComparisonItem[] => {
  const { entityA, entityB, sharedAttributes } = data;

  const sharedKeys = new Set(sharedAttributes.map(s => itemKey(s.category, s.value)));
  const bByKey = new Set(entityB.attributes.map(b => itemKey(b.category, b.value)));
  const aByKey = new Set(entityA.attributes.map(a => itemKey(a.category, a.value)));

  const items: ComparisonItem[] = [];
  const seen = new Set<string>();

  const push = (category: string, value: string, correctRegion: ComparisonRegion) => {
    const key = itemKey(category, value);
    if (seen.has(key)) return; // identical text, one card, one answer
    seen.add(key);
    items.push({ key, category, value, correctRegion });
  };

  // Shared first, so a genuinely shared claim can never be re-filed as A-only.
  sharedAttributes.forEach(s => push(s.category, s.value, 'shared'));

  entityA.attributes.forEach(a => {
    const key = itemKey(a.category, a.value);
    push(a.category, a.value, sharedKeys.has(key) || bByKey.has(key) ? 'shared' : 'A-only');
  });

  // Entity B is no longer dropped for reusing a category — a parallel category
  // with a DIFFERENT value ("bigger" vs "smaller") is the contrast itself.
  entityB.attributes.forEach(b => {
    const key = itemKey(b.category, b.value);
    push(b.category, b.value, sharedKeys.has(key) || aByKey.has(key) ? 'shared' : 'B-only');
  });

  return items;
};

// ============================================================================
// Component Props
// ============================================================================

interface CompareContrastProps {
  data: CompareContrastData;
  className?: string;
}

// ============================================================================
// Entity Image Component (shared between views)
// ============================================================================

const EntityImage: React.FC<{
  entity: EntityInfo;
  colorScheme: 'blue' | 'purple';
  generatedUrl: string | null;
  isLoading: boolean;
  hasError: boolean;
  onGenerate: () => void;
  loadingAny: boolean;
  isPreReader: boolean;
}> = ({ entity, colorScheme, generatedUrl, isLoading, hasError, onGenerate, loadingAny, isPreReader }) => {
  const borderColor = colorScheme === 'blue' ? 'border-blue-400/30' : 'border-purple-400/30';
  const textColor = colorScheme === 'blue' ? 'text-blue-300' : 'text-purple-300';
  const accentColor = colorScheme === 'blue' ? '#60a5fa' : '#c084fc';
  const bgColor = colorScheme === 'blue' ? 'rgba(96, 165, 250, 0.05)' : 'rgba(192, 132, 252, 0.05)';
  const borderDashed = colorScheme === 'blue' ? 'border-blue-400/20' : 'border-purple-400/20';

  const displayUrl = entity.imageUrl || generatedUrl;

  // Loading state
  if (isLoading) {
    return (
      <div
        className={`mt-4 rounded-xl flex flex-col items-center justify-center min-h-[200px] border-2 ${borderDashed}`}
        style={{ backgroundColor: bgColor }}
      >
        <div
          className="w-10 h-10 border-4 border-white/10 border-t-current rounded-full animate-spin mb-3"
          style={{ color: accentColor }}
        />
        {!isPreReader && (
          <p className="text-sm font-medium" style={{ color: accentColor }}>
            Generating visualization...
          </p>
        )}
      </div>
    );
  }

  // Generated or provided image.
  //
  // `imagePrompt` is an image-GENERATION instruction, not student copy. It was
  // rendered as visible caption text at every grade — the same leak removed from
  // classification-sorter (S9) and life-cycle-sequencer (S13). Removed here for
  // all grades too.
  if (displayUrl) {
    return (
      <div className={`mt-4 rounded-xl overflow-hidden border ${borderColor} relative`}>
        <img
          src={displayUrl}
          alt={entity.name}
          className={`w-full object-cover ${isPreReader ? 'h-56' : 'h-48'}`}
        />
      </div>
    );
  }

  // Placeholder. At K-2 the "Generate Visual" affordance is adult chrome the
  // child cannot read, and the registry now pre-generates images for this band,
  // so the placeholder stays quiet rather than offering a button.
  return (
    // dropzone-triage: decorative image placeholder, out of scope
    <div
      className={`mt-4 rounded-xl flex flex-col items-center justify-center min-h-[200px] border-2 border-dashed ${borderDashed} p-6`}
      style={{ backgroundColor: bgColor }}
    >
      {isPreReader ? (
        <ImageIcon className="w-14 h-14" style={{ color: accentColor, opacity: 0.5 }} />
      ) : (
        <>
          <p className="text-sm text-slate-400 italic text-center mb-4">{entity.name}</p>
          {!hasError && (
            <Button
              onClick={onGenerate}
              disabled={loadingAny}
              variant="ghost"
              className={`bg-white/5 border border-white/20 hover:bg-white/10 ${textColor}`}
            >
              <ImageIcon className="w-4 h-4 mr-2" />
              Generate Visual
            </Button>
          )}
          <p className="text-xs text-slate-500 text-center mt-3 italic">
            {hasError ? 'Image generation failed. Try again later.' : 'Click to generate an AI visualization'}
          </p>
        </>
      )}
    </div>
  );
};

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Side-by-side comparison mode
 * Shows both entities with aligned attributes, highlighting differences
 */
const SideBySideView: React.FC<{
  data: CompareContrastData;
  isPreReader: boolean;
  readAloud: (text: string) => void;
}> = ({ data, isPreReader, readAloud }) => {
  const { entityA, entityB, sharedAttributes } = data;

  // Image generation state
  const [generatedImages, setGeneratedImages] = useState<Record<string, string>>({});
  const [loadingEntity, setLoadingEntity] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const handleGenerateImage = async (entity: EntityInfo, entityKey: string) => {
    if (!entity.imagePrompt || loadingEntity || generatedImages[entityKey] || entity.imageUrl) return;

    setLoadingEntity(entityKey);
    setImageErrors(prev => ({ ...prev, [entityKey]: false }));

    try {
      const response = await fetch('/api/lumina', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generateSpeciesImage',
          params: {
            imagePrompt: entity.imagePrompt,
          }
        })
      });

      if (!response.ok) {
        throw new Error('Image generation request failed');
      }

      const result = await response.json();
      if (result.imageUrl) {
        setGeneratedImages(prev => ({ ...prev, [entityKey]: result.imageUrl }));
      } else {
        setImageErrors(prev => ({ ...prev, [entityKey]: true }));
      }
    } catch (error) {
      console.error('Failed to generate entity image:', error);
      setImageErrors(prev => ({ ...prev, [entityKey]: true }));
    } finally {
      setLoadingEntity(null);
    }
  };

  // Get all unique category names
  const allCategories = Array.from(
    new Set([
      ...entityA.attributes.map(a => a.category),
      ...entityB.attributes.map(a => a.category),
      ...sharedAttributes.map(a => a.category)
    ])
  );

  return (
    <div className="space-y-6">
      {/* Entity Headers */}
      <div className="grid grid-cols-2 gap-6">
        {/* Entity A */}
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 backdrop-blur-sm rounded-2xl border border-blue-400/20 p-6">
          <div className="flex items-center gap-2 mb-2">
            <h3 className={`font-bold text-blue-300 ${isPreReader ? 'text-3xl' : 'text-2xl'}`}>{entityA.name}</h3>
            {isPreReader && (
              <LuminaReadAloud
                iconOnly
                size="sm"
                aria-label={`Hear the name ${entityA.name}`}
                onClick={() => readAloud(entityA.name)}
              />
            )}
          </div>
          <EntityImage
            entity={entityA}
            colorScheme="blue"
            generatedUrl={generatedImages['entityA'] || null}
            isLoading={loadingEntity === 'entityA'}
            hasError={imageErrors['entityA'] || false}
            onGenerate={() => handleGenerateImage(entityA, 'entityA')}
            loadingAny={!!loadingEntity}
            isPreReader={isPreReader}
          />
        </div>

        {/* Entity B */}
        <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 backdrop-blur-sm rounded-2xl border border-purple-400/20 p-6">
          <div className="flex items-center gap-2 mb-2">
            <h3 className={`font-bold text-purple-300 ${isPreReader ? 'text-3xl' : 'text-2xl'}`}>{entityB.name}</h3>
            {isPreReader && (
              <LuminaReadAloud
                iconOnly
                size="sm"
                aria-label={`Hear the name ${entityB.name}`}
                onClick={() => readAloud(entityB.name)}
              />
            )}
          </div>
          <EntityImage
            entity={entityB}
            colorScheme="purple"
            generatedUrl={generatedImages['entityB'] || null}
            isLoading={loadingEntity === 'entityB'}
            hasError={imageErrors['entityB'] || false}
            onGenerate={() => handleGenerateImage(entityB, 'entityB')}
            loadingAny={!!loadingEntity}
            isPreReader={isPreReader}
          />
        </div>
      </div>

      {/* Attribute Comparison */}
      <div className="space-y-3">
        {allCategories.map((category) => {
          const attrA = entityA.attributes.find(a => a.category === category);
          const attrB = entityB.attributes.find(a => a.category === category);
          const shared = sharedAttributes.find(a => a.category === category);

          const isShared = shared || (attrA && attrB && attrA.value === attrB.value);

          const valueA = shared?.value || attrA?.value || '—';
          const valueB = shared?.value || attrB?.value || '—';

          const rowClass = `gap-4 p-4 rounded-xl border ${
            isShared
              ? 'bg-emerald-500/10 border-emerald-400/30'
              : 'bg-slate-800/30 border-slate-700/50'
          }`;

          // At K-2 the row IS the listen affordance: the whole point of a viewer
          // the child cannot read is that tapping it speaks. The row is rendered
          // as the kit's LuminaReadAloud rather than a button wrapping one —
          // nesting them produced `validateDOMNesting: <button> cannot appear as
          // a descendant of <button>`, which real Chrome caught and jsdom did
          // not. This keeps ONE button, a full-row tap target, and the kit glyph
          // a pre-reader learns once.
          if (isPreReader) {
            const spoken = isShared
              ? `${category}. Both of them: ${valueA}`
              : `${category}. ${entityA.name}: ${valueA}. ${entityB.name}: ${valueB}`;
            return (
              <LuminaReadAloud
                key={category}
                size="lg"
                label={category}
                aria-label={`Read ${category} aloud`}
                onClick={() => readAloud(spoken)}
                className={`w-full justify-start gap-4 rounded-xl border text-lg font-semibold text-left ${
                  isShared
                    ? 'bg-emerald-500/10 border-emerald-400/30'
                    : 'bg-slate-800/30 border-slate-700/50'
                }`}
              />
            );
          }

          return (
            <div key={category} className={`grid grid-cols-[200px_1fr_1fr] ${rowClass}`}>
              {/* Category Label */}
              <div className="font-semibold text-slate-300 flex items-center gap-2">
                {isShared && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                {category}
              </div>

              {/* Entity A Value */}
              <div className={`${isShared ? 'text-emerald-200' : 'text-blue-200'}`}>{valueA}</div>

              {/* Entity B Value */}
              <div className={`${isShared ? 'text-emerald-200' : 'text-purple-200'}`}>{valueB}</div>
            </div>
          );
        })}
      </div>

      {/* Shared Attributes Summary — a text ledger; adult chrome at K-2, where
          the emerald rows above already carry "both" without a second list. */}
      {sharedAttributes.length > 0 && !isPreReader && (
        <div className="bg-emerald-500/10 backdrop-blur-sm rounded-xl border border-emerald-400/30 p-6">
          <h4 className="text-lg font-semibold text-emerald-300 mb-3 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Shared Characteristics
          </h4>
          <ul className="space-y-2">
            {sharedAttributes.map((attr, idx) => (
              <li key={idx} className="flex items-start gap-3 text-slate-300">
                <span className="text-emerald-400 mt-1">•</span>
                <span>
                  <span className="font-medium">{attr.category}:</span> {attr.value}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

/**
 * Pre-reader comparison mode (K-2) — the assessed path.
 *
 * The Venn diagram is three simultaneous drop targets fed by ~17 draggable text
 * cards, behind a multi-clause written protocol and a deferred "Check My Work"
 * button. Every one of those is a PRE contract failure (rules 1, 2, 4, 5, 7).
 *
 * The comparative judgment underneath it is genuinely K-fit, though: "does this
 * belong to A, to B, or to both?" is the atomic act the Venn assesses. So the
 * task identity is kept and only the protocol changes — one characteristic at a
 * time, spoken by the tutor, answered by tapping one of three pictures. This is
 * the WordSorter/classification-sorter (S9) precedent applied to the same drag
 * mechanic, not a new invention.
 */
const PreReaderCompareView: React.FC<{
  data: CompareContrastData;
  items: ComparisonItem[];
  readAloud: (text: string) => void;
  onAttributeShown: (item: ComparisonItem) => void;
  onAnswered: (item: ComparisonItem, chosen: ComparisonRegion, isCorrect: boolean) => void;
  onFinished: (correct: number, total: number) => void;
  onEvaluate: (placements: Array<{ attributeValue: string; placedRegion: string; correctRegion: string; isCorrect: boolean }>) => void;
}> = ({ data, items, readAloud, onAttributeShown, onAnswered, onFinished, onEvaluate }) => {
  const { entityA, entityB } = data;

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Array<{ item: ComparisonItem; chosen: ComparisonRegion; isCorrect: boolean }>>([]);
  const [flash, setFlash] = useState<{ region: ComparisonRegion; correct: boolean } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = items[index];
  const done = index >= items.length;

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    },
    []
  );

  // STIMULUS: the tutor's voice IS the text on this card. Fires on every change
  // of the staged characteristic, including the first.
  useEffect(() => {
    if (!current) return;
    onAttributeShown(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.key]);

  // Submit once, when the last characteristic is answered.
  const hasSubmittedRef = useRef(false);
  useEffect(() => {
    if (!done || hasSubmittedRef.current || items.length === 0) return;
    hasSubmittedRef.current = true;
    const correct = answers.filter(a => a.isCorrect).length;
    onEvaluate(
      answers.map(a => ({
        attributeValue: a.item.key,
        placedRegion: a.chosen,
        correctRegion: a.item.correctRegion,
        isCorrect: a.isCorrect,
      }))
    );
    onFinished(correct, items.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, items.length]);

  const choose = (region: ComparisonRegion) => {
    if (!current || flash) return;
    const isCorrect = region === current.correctRegion;

    SoundManager.snap();
    setFlash({ region, correct: isCorrect });
    setAnswers(prev => [...prev, { item: current, chosen: region, isCorrect }]);
    onAnswered(current, region, isCorrect);

    if (flashTimer.current) clearTimeout(flashTimer.current);
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 850);
    advanceTimer.current = setTimeout(() => setIndex(i => i + 1), 900);
  };

  const targetClass = (region: ComparisonRegion, base: string) => {
    if (flash && flash.region === region) {
      return flash.correct
        ? 'border-emerald-400 bg-emerald-500/25 scale-105'
        : 'border-rose-400 bg-rose-500/25 animate-pulse';
    }
    return base;
  };

  if (done) {
    const correct = answers.filter(a => a.isCorrect).length;
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-16">
        <div className="text-7xl">🎉</div>
        <div className="flex gap-2">
          {answers.map((a, i) => (
            <span
              key={i}
              className={`w-6 h-6 rounded-full ${a.isCorrect ? 'bg-emerald-400' : 'bg-slate-600'}`}
              aria-label={a.isCorrect ? 'correct' : 'not correct'}
            />
          ))}
        </div>
        <span className="sr-only">{correct} of {items.length}</span>
      </div>
    );
  }

  if (!current) return null;

  // The three answer targets. Pictures where we have them (the registry turns
  // image generation on for this band), the name as the caption underneath.
  const EntityTarget: React.FC<{ entity: EntityInfo; region: ComparisonRegion; accent: string }> = ({ entity, region, accent }) => (
    <button
      type="button"
      onClick={() => choose(region)}
      disabled={!!flash}
      aria-label={`${entity.name} only`}
      className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all min-h-[180px] justify-center ${targetClass(region, accent)}`}
    >
      {entity.imageUrl ? (
        <img src={entity.imageUrl} alt={entity.name} className="w-28 h-28 object-cover rounded-xl" />
      ) : (
        <ImageIcon className="w-20 h-20 text-slate-500" />
      )}
      <span className="text-xl font-bold text-slate-100">{entity.name}</span>
    </button>
  );

  return (
    <div className="space-y-8">
      {/* The staged characteristic — one thing on screen to think about. */}
      <div className="bg-slate-800/40 backdrop-blur-sm rounded-2xl border border-white/10 p-8 flex items-center gap-4">
        <div className="flex-1">
          <div className="text-3xl font-bold text-white leading-snug">{current.category}</div>
          <div className="text-xl text-slate-300 mt-2 leading-relaxed">{current.value}</div>
        </div>
        <LuminaReadAloud
          size="lg"
          aria-label="Hear it again"
          onClick={() => readAloud(`${current.category}. ${current.value}`)}
        />
      </div>

      {/* Three tap targets: A / BOTH / B. Tap = choose = commit = advance. */}
      <div className="grid grid-cols-3 gap-4">
        <EntityTarget entity={entityA} region="A-only" accent="border-blue-400/40 bg-blue-500/10 hover:bg-blue-500/20" />

        <button
          type="button"
          onClick={() => choose('shared')}
          disabled={!!flash}
          aria-label="Both of them"
          className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all min-h-[180px] justify-center ${targetClass('shared', 'border-emerald-400/40 bg-emerald-500/10 hover:bg-emerald-500/20')}`}
        >
          <div className="flex items-center -space-x-4">
            {entityA.imageUrl ? (
              <img src={entityA.imageUrl} alt="" className="w-16 h-16 object-cover rounded-full border-2 border-slate-800" />
            ) : (
              <ImageIcon className="w-12 h-12 text-slate-500" />
            )}
            {entityB.imageUrl ? (
              <img src={entityB.imageUrl} alt="" className="w-16 h-16 object-cover rounded-full border-2 border-slate-800" />
            ) : (
              <ImageIcon className="w-12 h-12 text-slate-500" />
            )}
          </div>
          <span className="text-xl font-bold text-emerald-200">Both</span>
        </button>

        <EntityTarget entity={entityB} region="B-only" accent="border-purple-400/40 bg-purple-500/10 hover:bg-purple-500/20" />
      </div>

      {/* Progress as dots, not "3 of 17" — no counters in the child's field. */}
      <div className="flex justify-center gap-2">
        {items.map((_, i) => (
          <span
            key={i}
            className={`w-3 h-3 rounded-full ${
              i < index ? 'bg-emerald-400' : i === index ? 'bg-white' : 'bg-slate-700'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * Interactive Venn diagram mode
 * Students drag attributes into correct regions
 */
const VennInteractiveView: React.FC<{
  data: CompareContrastData;
  allAttributes: ComparisonItem[];
  onEvaluate: (placements: Array<{ attributeValue: string; placedRegion: string; correctRegion: string; isCorrect: boolean }>) => void;
}> = ({ data, allAttributes, onEvaluate }) => {
  type VennRegion = ComparisonRegion;
  const { entityA, entityB } = data;

  // Student placements: { attributeValue: string, region: 'A-only' | 'B-only' | 'shared' }
  const [placements, setPlacements] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [hoveredRegion, setHoveredRegion] = useState<VennRegion | null>(null);
  const [showGradingFlash, setShowGradingFlash] = useState(false);
  const gradingFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (gradingFlashTimer.current) clearTimeout(gradingFlashTimer.current);
    },
    []
  );

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, attrValue: string) => {
    e.dataTransfer.setData('attributeValue', attrValue);
  };

  const handleDrop = (e: React.DragEvent, region: VennRegion) => {
    e.preventDefault();
    setHoveredRegion(null);
    const attrValue = e.dataTransfer.getData('attributeValue');
    SoundManager.snap();
    setPlacements(prev => ({ ...prev, [attrValue]: region }));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleSubmit = () => {
    const results = allAttributes.map(attr => {
      const placedRegion = placements[attr.key] || 'unplaced';
      return {
        attributeValue: attr.key,
        placedRegion,
        correctRegion: attr.correctRegion,
        isCorrect: placedRegion === attr.correctRegion
      };
    });

    onEvaluate(results);
    setSubmitted(true);
    if (gradingFlashTimer.current) clearTimeout(gradingFlashTimer.current);
    setShowGradingFlash(true);
    gradingFlashTimer.current = setTimeout(() => setShowGradingFlash(false), 900);
  };

  const handleReset = () => {
    setPlacements({});
    setSubmitted(false);
    setHoveredRegion(null);
    setShowGradingFlash(false);
    if (gradingFlashTimer.current) clearTimeout(gradingFlashTimer.current);
  };

  // Get attributes by placement
  const getAttributesForRegion = (region: string) =>
    allAttributes.filter(attr => placements[attr.key] === region);

  const unplacedAttributes = allAttributes.filter(attr => !placements[attr.key]);

  const regionLabel: Record<VennRegion, string> = {
    'A-only': `${entityA.name} only`,
    'shared': 'Both',
    'B-only': `${entityB.name} only`,
  };

  const getRegionState = (region: VennRegion): DropZoneState => {
    const attributes = getAttributesForRegion(region);
    const expectedCount = allAttributes.filter(attr => attr.correctRegion === region).length;
    const regionIsCorrect =
      attributes.length === expectedCount && attributes.every(attr => attr.correctRegion === region);

    return hoveredRegion === region
      ? 'dragOver'
      : showGradingFlash
        ? regionIsCorrect
          ? 'correct'
          : 'incorrect'
        : attributes.length > 0
          ? 'filled'
          : 'idle';
  };

  const renderPlacedCard = (attr: ComparisonItem, region: VennRegion, idx: number) => {
    const isCorrect = attr.correctRegion === region;
    return (
      <div
        key={idx}
        draggable={!submitted}
        onDragStart={(e) => handleDragStart(e, attr.key)}
        className={`p-3 rounded-lg cursor-move ${
          submitted
            ? isCorrect
              ? 'bg-emerald-500/20 border border-emerald-400/50'
              : 'bg-red-500/20 border border-red-400/50'
            : 'bg-slate-700/50 border border-slate-600'
        }`}
      >
        <div className="text-sm font-medium text-slate-200">{attr.category}</div>
        <div className="text-xs text-slate-400">{attr.value}</div>
        {submitted && !isCorrect && (
          // Say it in the student's own words — "A-only" is a dev slug.
          <div className="text-xs text-red-300 mt-1">✗ Belongs in "{regionLabel[attr.correctRegion]}"</div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="bg-blue-500/10 backdrop-blur-sm rounded-xl border border-blue-400/30 p-4">
        <p className="text-slate-300 flex items-start gap-2">
          <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
          <span>
            Drag each characteristic into the correct region of the Venn diagram:
            <strong className="text-blue-300"> {entityA.name} only</strong>,
            <strong className="text-purple-300"> {entityB.name} only</strong>, or
            <strong className="text-emerald-300"> Both</strong>.
          </span>
        </p>
      </div>

      {/* Venn Diagram */}
      <div className="grid grid-cols-3 gap-4">
        {/* Left Circle (A-only) */}
        <LuminaDropZone
          state={getRegionState('A-only')}
          emptyPrompt="Drop attributes here"
          onDrop={(e) => handleDrop(e, 'A-only')}
          onDragOver={(e) => { handleDragOver(e); setHoveredRegion('A-only'); }}
          onDragLeave={() => setHoveredRegion(null)}
          className="min-h-[300px] flex-col items-stretch justify-start p-6"
        >
          <h4 className="text-lg font-semibold text-blue-300 mb-4 text-center">{entityA.name} Only</h4>
          <div className="space-y-2">
            {getAttributesForRegion('A-only').map((attr, idx) => renderPlacedCard(attr, 'A-only', idx))}
          </div>
        </LuminaDropZone>

        {/* Center Overlap (shared) */}
        <LuminaDropZone
          state={getRegionState('shared')}
          emptyPrompt="Drop attributes here"
          onDrop={(e) => handleDrop(e, 'shared')}
          onDragOver={(e) => { handleDragOver(e); setHoveredRegion('shared'); }}
          onDragLeave={() => setHoveredRegion(null)}
          className="min-h-[300px] flex-col items-stretch justify-start p-6"
        >
          <h4 className="text-lg font-semibold text-emerald-300 mb-4 text-center">Both</h4>
          <div className="space-y-2">
            {getAttributesForRegion('shared').map((attr, idx) => renderPlacedCard(attr, 'shared', idx))}
          </div>
        </LuminaDropZone>

        {/* Right Circle (B-only) */}
        <LuminaDropZone
          state={getRegionState('B-only')}
          emptyPrompt="Drop attributes here"
          onDrop={(e) => handleDrop(e, 'B-only')}
          onDragOver={(e) => { handleDragOver(e); setHoveredRegion('B-only'); }}
          onDragLeave={() => setHoveredRegion(null)}
          className="min-h-[300px] flex-col items-stretch justify-start p-6"
        >
          <h4 className="text-lg font-semibold text-purple-300 mb-4 text-center">{entityB.name} Only</h4>
          <div className="space-y-2">
            {getAttributesForRegion('B-only').map((attr, idx) => renderPlacedCard(attr, 'B-only', idx))}
          </div>
        </LuminaDropZone>
      </div>

      {/* Unplaced Attributes */}
      {unplacedAttributes.length > 0 && (
        <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl border border-slate-700 p-4">
          <h4 className="text-sm font-semibold text-slate-400 mb-3">Drag these attributes to the correct region:</h4>
          <div className="flex flex-wrap gap-2">
            {unplacedAttributes.map((attr, idx) => (
              <div
                key={idx}
                draggable
                onDragStart={(e) => handleDragStart(e, attr.key)}
                className="p-2 rounded-lg bg-slate-700/50 border border-slate-600 cursor-move hover:bg-slate-700/70 transition"
              >
                <div className="text-sm font-medium text-slate-200">{attr.category}</div>
                <div className="text-xs text-slate-400">{attr.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submit Button */}
      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={submitted || unplacedAttributes.length > 0}
          className="px-6 py-3 bg-blue-500 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 transition"
        >
          {submitted ? 'Submitted' : 'Check My Work'}
        </button>
        {submitted && (
          <button
            onClick={handleReset}
            className="px-6 py-3 bg-slate-600 text-white rounded-lg font-semibold hover:bg-slate-700 transition"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

const CompareContrast: React.FC<CompareContrastProps> = ({ data, className = '' }) => {
  const {
    instanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onEvaluationSubmit,
  } = data;

  // K-2 cannot read the title, the characteristics, the entity names or any
  // button label, and cannot execute an HTML5 drag. Gate on the band.
  const isPreReader = data.gradeBand === 'K-2';

  const resolvedInstanceId = instanceId || `compare-contrast-${data.title}`;

  const items = useMemo(() => buildComparisonItems(data), [data]);

  const [answeredCount, setAnsweredCount] = useState(0);
  const [currentAttribute, setCurrentAttribute] = useState('nothing yet');
  const [checked, setChecked] = useState(false);

  // Flat object literal — a bag assembled behind local statements makes
  // tutor-test report every contextKey as "dynamic, verify at runtime".
  const aiPrimitiveData = useMemo(() => ({
    title: data.title,
    entityAName: data.entityA.name,
    entityBName: data.entityB.name,
    mode: data.mode,
    gradeBand: data.gradeBand,
    currentAttribute,
    answeredCount,
    totalAttributes: items.length,
    checked,
  }), [
    data.title, data.entityA.name, data.entityB.name, data.mode, data.gradeBand,
    currentAttribute, answeredCount, items.length, checked,
  ]);

  const { sendText } = useLuminaAI({
    primitiveType: 'bio-compare-contrast',
    instanceId: resolvedInstanceId,
    primitiveData: aiPrimitiveData,
    gradeLevel: isPreReader ? 'kindergarten' : 'elementary',
  });

  // `silent` suppresses only the chat-transcript entry; the tutor still speaks.
  const readAloud = useCallback((text: string) => {
    if (!text) return;
    SoundManager.tap();
    sendText(
      `[COMPARE_READ_ALOUD] The young learner tapped "read it to me" and cannot read the screen. `
      + `Read this aloud, word for word, warmly and slowly: "${text}". Then wait.`,
      { silent: true },
    );
  }, [sendText]);

  // ORIENT — fires once so a non-reader learns the task without having to ask.
  const hasOrientedRef = useRef(false);
  useEffect(() => {
    if (hasOrientedRef.current) return;
    hasOrientedRef.current = true;
    sendText(
      `[COMPARE_ORIENT] A ${isPreReader ? 'pre-reader who cannot read any text' : 'student'} just opened `
      + `a comparison of "${data.entityA.name}" and "${data.entityB.name}" — ${data.title}. `
      + `${data.mode === 'venn-interactive'
        ? isPreReader
          ? 'They will hear one thing at a time and tap the first picture, the second picture, or BOTH.'
          : 'They drag every characteristic into the correct part of a Venn diagram, then check their work.'
        : 'This one is for looking and listening — there is nothing to sort.'} `
      + `Name the two things and say what to do, in child words. `
      + `NEVER say which side any characteristic belongs on — that is the answer.`,
      { silent: true },
    );
  }, [sendText, isPreReader, data.title, data.mode, data.entityA.name, data.entityB.name]);

  // STIMULUS — the tutor's voice IS the characteristic card for a non-reader.
  const onAttributeShown = useCallback((item: ComparisonItem) => {
    setCurrentAttribute(`${item.category}: ${item.value}`);
    sendText(
      `[COMPARE_ATTRIBUTE_SHOWN] The student is now looking at this one thing: "${item.category}: ${item.value}". `
      + `SAY it aloud in child words and ask whether it belongs to ${data.entityA.name}, to ${data.entityB.name}, or to BOTH. `
      + `Do NOT answer it, and do NOT rule any of the three out.`,
      { silent: true },
    );
  }, [sendText, data.entityA.name, data.entityB.name]);

  const onAnswered = useCallback((item: ComparisonItem, chosen: ComparisonRegion, isCorrect: boolean) => {
    setAnsweredCount(c => c + 1);
    const spoken: Record<ComparisonRegion, string> = {
      'A-only': `only ${data.entityA.name}`,
      'B-only': `only ${data.entityB.name}`,
      'shared': 'both of them',
    };
    sendText(
      `[COMPARE_ANSWERED] For "${item.category}" the student chose ${spoken[chosen]}, which is `
      + `${isCorrect ? 'RIGHT' : 'not right'}. React warmly in ONE short sentence. `
      + `${isCorrect ? '' : `Say kindly what the true answer is for THIS one — ${spoken[item.correctRegion]} — and why, in child words. `}`
      + `Say nothing about the things they have not seen yet.`,
      { silent: true },
    );
  }, [sendText, data.entityA.name, data.entityB.name]);

  const onFinished = useCallback((correct: number, total: number) => {
    setChecked(true);
    sendText(
      `[COMPARE_FINISHED] The student finished all ${total} and got ${correct} right. `
      + `Celebrate warmly in one or two sentences and say one true thing that ${data.entityA.name} `
      + `and ${data.entityB.name} share. Do not read out a score.`,
      { silent: true },
    );
  }, [sendText, data.entityA.name, data.entityB.name]);

  // Initialize evaluation hook (only for the assessed modes)
  const { submitResult } = usePrimitiveEvaluation<CompareContrastMetrics>({
    primitiveType: 'bio-compare-contrast',
    instanceId: resolvedInstanceId,
    skillId,
    subskillId,
    objectiveId,
    exhibitId,
    onSubmit: onEvaluationSubmit,
  });

  const handleEvaluate = (placements: Array<{ attributeValue: string; placedRegion: string; correctRegion: string; isCorrect: boolean }>) => {
    const correctCount = placements.filter(p => p.isCorrect).length;
    const totalCount = placements.length;
    const accuracy = totalCount > 0 ? (correctCount / totalCount) * 100 : 0;
    const success = accuracy >= 70; // 70% threshold for success

    setChecked(true);

    const metrics: CompareContrastMetrics = {
      type: 'bio-compare-contrast',
      mode: data.mode,
      totalAttributes: totalCount,
      correctPlacements: correctCount,
      accuracy,
      placements,
    };

    submitResult(success, accuracy, metrics, {
      studentWork: { placements },
    });
  };

  return (
    <div className={`${className}`}>
      {/* Title */}
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <ArrowLeftRight className="w-8 h-8 text-blue-400" />
          {data.title}
          {isPreReader && (
            <LuminaReadAloud
              iconOnly
              size="sm"
              aria-label="Read the title aloud"
              onClick={() => readAloud(data.title)}
            />
          )}
        </h2>
        {/* "Grade 3-5 • Visual Comparison" is a developer readout; a five-year-old
            can neither read it nor use it. */}
        {!isPreReader && (
          <div className="text-sm text-slate-400">
            Grade {data.gradeBand} • {data.mode === 'side-by-side' ? 'Visual Comparison' : 'Interactive Activity'}
          </div>
        )}
      </div>

      {/* Content */}
      {data.mode === 'side-by-side' ? (
        <SideBySideView data={data} isPreReader={isPreReader} readAloud={readAloud} />
      ) : isPreReader ? (
        <PreReaderCompareView
          data={data}
          items={items}
          readAloud={readAloud}
          onAttributeShown={onAttributeShown}
          onAnswered={onAnswered}
          onFinished={onFinished}
          onEvaluate={handleEvaluate}
        />
      ) : (
        <VennInteractiveView data={data} allAttributes={items} onEvaluate={handleEvaluate} />
      )}

      {/* Key Insight */}
      <div className="mt-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 backdrop-blur-sm rounded-xl border border-blue-400/30 p-6">
        <h4 className="text-lg font-semibold text-blue-300 mb-2 flex items-center gap-2">
          <Info className="w-5 h-5" />
          {isPreReader ? 'The big idea' : 'Why This Comparison Matters'}
          {isPreReader && (
            <LuminaReadAloud
              iconOnly
              size="sm"
              aria-label="Read the big idea aloud"
              onClick={() => readAloud(data.keyInsight)}
            />
          )}
        </h4>
        <p className="text-slate-300 leading-relaxed">{data.keyInsight}</p>
      </div>
    </div>
  );
};

export default CompareContrast;
