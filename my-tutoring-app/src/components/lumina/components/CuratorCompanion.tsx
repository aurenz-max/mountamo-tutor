'use client';

/**
 * CuratorCompanion — the K-5-native face of the Curator.
 *
 * Same brain as {@link CuratorConsole} (it reads the live primitive state via
 * LuminaAIContext and surfaces grounded, tappable next-steps from each
 * primitive's authored `studentPrompts`), but a *body* instead of a chat panel.
 *
 * For a 5-to-10-year-old a docked message box reads as "the thing grown-ups
 * type into". So here the helper is an embodied character — "Pip" — who lives
 * at the edge of the scene, emotes (idle / thinking / speaking / celebrating /
 * sleeping), speaks in a large read-aloud bubble, and offers a *small* number
 * of huge emoji-forward choice bubbles. Voice-first: a hold-to-talk mic is the
 * primary input; typing/transcript hide behind an "advanced" toggle for older
 * grades and accessibility.
 *
 * Audio OUTPUT (Pip speaking) is handled by the context's Gemini Live session;
 * the bubble shows the words and the character's mouth animates in sync.
 *
 * Must be rendered inside <LuminaAIProvider> (i.e. within LessonScreen).
 *
 * PHASE 2 (not yet built): true didiegetic gesture — Pip pointing at the actual
 * bucket/arm in the diagram — needs primitives to publish spatial anchors. Today
 * Pip only "leans" toward the scene as a lightweight stand-in.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import { getComponentById } from '../service/manifest/catalog';
import { getPrimitive } from '../config/primitiveRegistry';
import { interpolateTemplate } from '../utils/interpolateTemplate';
import type { ComponentId, StudentPrompt, StudentPromptKind } from '../types';
import { Mic, Send, RefreshCw, Loader2, MessageSquare, X } from 'lucide-react';

/** Human-facing name for the active primitive (registry title → title-cased id). */
function friendlyPrimitiveName(type: string | null): string | null {
  if (!type) return null;
  const title = getPrimitive(type as ComponentId)?.sectionTitle;
  if (title) return title;
  return type
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ── Kind → kid-facing presentation ──────────────────────────────────────────
// Big single emoji reads pre-literate; the gradient encodes intent by color.
const KIND_EMOJI: Record<StudentPromptKind, string> = {
  hint: '💡',
  explain: '👀',
  check: '✅',
  advance: '⭐',
};
const KIND_GRADIENT: Record<StudentPromptKind, string> = {
  hint: 'from-amber-400/25 to-amber-500/10 border-amber-300/40 hover:border-amber-200/70',
  explain: 'from-sky-400/25 to-sky-500/10 border-sky-300/40 hover:border-sky-200/70',
  check: 'from-emerald-400/25 to-emerald-500/10 border-emerald-300/40 hover:border-emerald-200/70',
  advance: 'from-violet-400/25 to-violet-500/10 border-violet-300/40 hover:border-violet-200/70',
};

interface ConsolePrompt {
  label: string;
  prompt?: string;
  kind: StudentPromptKind;
  hintLevel?: 1 | 2 | 3;
}

/** A button shows unless its `showWhen` gate fails against live primitive_data. */
function passesShowWhen(p: StudentPrompt, data: Record<string, unknown>): boolean {
  const sw = p.showWhen;
  if (!sw) return true;
  const v = data[sw.key];
  return sw.equals !== undefined ? v === sw.equals : Boolean(v);
}

type Mood = 'sleeping' | 'thinking' | 'speaking' | 'happy' | 'excited';

// ── The character ───────────────────────────────────────────────────────────

/** Pip — a self-contained animated SVG creature. Mood drives face + posture;
 *  `talking` animates the mouth in time with the AI's voice. No external asset. */
const PipCharacter: React.FC<{ mood: Mood; talking: boolean; size?: number }> = ({
  mood,
  talking,
  size = 96,
}) => {
  const asleep = mood === 'sleeping';
  const excited = mood === 'excited';
  const thinking = mood === 'thinking';

  // Eye openness: half-lidded asleep, wide when excited, normal otherwise.
  const eyeScaleY = asleep ? 0.12 : excited ? 1.15 : 1;
  // Pupil drift — glances toward the scene (left) while idle/thinking.
  const pupilX = thinking ? -2.2 : 0;

  return (
    <motion.div
      // Whole-body float + breathe; a happy hop when excited.
      animate={
        asleep
          ? { y: [0, 1.5, 0] }
          : excited
            ? { y: [0, -10, 0], rotate: [0, -4, 4, 0] }
            : { y: [0, -5, 0] }
      }
      transition={{
        duration: asleep ? 3.4 : excited ? 0.55 : 2.6,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <defs>
          <radialGradient id="pip-body" cx="40%" cy="35%" r="75%">
            <stop offset="0%" stopColor="#67e8f9" />
            <stop offset="55%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#6366f1" />
          </radialGradient>
          <filter id="pip-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Antenna + glowing sparkle tip (ties to the Curator's spark brand) */}
        <line x1="50" y1="24" x2="50" y2="12" stroke="#a5f3fc" strokeWidth="2.5" strokeLinecap="round" />
        <motion.circle
          cx="50"
          cy="10"
          r="4"
          fill="#e0f2fe"
          filter="url(#pip-glow)"
          animate={
            asleep
              ? { opacity: [0.3, 0.5, 0.3] }
              : { opacity: [0.7, 1, 0.7], r: thinking ? [3.5, 5, 3.5] : [4, 4.6, 4] }
          }
          transition={{ duration: thinking ? 0.7 : 2, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Body */}
        <motion.ellipse
          cx="50"
          cy="58"
          rx="34"
          ry="32"
          fill="url(#pip-body)"
          animate={{ rx: [34, 35.5, 34], ry: [32, 30.5, 32] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Cheek blush when excited */}
        <AnimatePresence>
          {excited && (
            <>
              <motion.ellipse
                initial={{ opacity: 0 }} animate={{ opacity: 0.55 }} exit={{ opacity: 0 }}
                cx="32" cy="62" rx="6" ry="4" fill="#fb7185"
              />
              <motion.ellipse
                initial={{ opacity: 0 }} animate={{ opacity: 0.55 }} exit={{ opacity: 0 }}
                cx="68" cy="62" rx="6" ry="4" fill="#fb7185"
              />
            </>
          )}
        </AnimatePresence>

        {/* Eyes — white sclera + tracking pupil; blink loop when awake */}
        {[34, 66].map((cx) => (
          <g key={cx}>
            <motion.ellipse
              cx={cx}
              cy="52"
              rx="8"
              ry="9"
              fill="#0f172a"
              style={{ originY: '52px' }}
              animate={{ scaleY: asleep ? eyeScaleY : [1, 1, 0.1, 1] }}
              transition={
                asleep
                  ? { duration: 0.3 }
                  : { duration: 4, times: [0, 0.92, 0.96, 1], repeat: Infinity, ease: 'linear' }
              }
            />
            {!asleep && (
              <>
                <motion.circle
                  cx={cx} cy="50" r="3.4" fill="#fff"
                  animate={{ cx: cx + pupilX }}
                  transition={{ duration: 0.6, ease: 'easeInOut' }}
                />
                <circle cx={cx + 1.2} cy="48.6" r="1.1" fill="#fff" opacity="0.9" />
              </>
            )}
          </g>
        ))}

        {/* Closed-eye lashes when asleep */}
        {asleep &&
          [34, 66].map((cx) => (
            <line key={cx} x1={cx - 7} y1="52" x2={cx + 7} y2="52" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" />
          ))}

        {/* Mouth — morphs by mood; animates open/closed while talking */}
        {asleep ? (
          <ellipse cx="50" cy="72" rx="3" ry="2.5" fill="#0f172a" opacity="0.6" />
        ) : talking ? (
          <motion.ellipse
            cx="50" cy="71" rx="6" fill="#0f172a"
            animate={{ ry: [2, 6.5, 3, 5.5, 2] }}
            transition={{ duration: 0.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        ) : excited ? (
          <path d="M 38 68 Q 50 82 62 68 Q 50 74 38 68 Z" fill="#0f172a" />
        ) : (
          <path d="M 40 70 Q 50 78 60 70" stroke="#0f172a" strokeWidth="3" fill="none" strokeLinecap="round" />
        )}

        {/* Z's while sleeping */}
        {asleep && (
          <motion.text
            x="78" y="34" fontSize="12" fontWeight="bold" fill="#a5f3fc"
            animate={{ opacity: [0, 1, 0], y: [34, 26, 18] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
          >
            z
          </motion.text>
        )}
      </svg>
    </motion.div>
  );
};

interface CuratorCompanionProps {
  defaultExpanded?: boolean;
}

export const CuratorCompanion: React.FC<CuratorCompanionProps> = ({ defaultExpanded = true }) => {
  const {
    isConnected,
    isAIResponding,
    conversation,
    activePrimitiveType,
    activePrimitiveData,
    sendText,
    requestHint,
    startListening,
    stopListening,
    isListening,
    sessionEnded,
    reconnect,
  } = useLuminaAIContext();

  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [text, setText] = useState('');
  const [reconnecting, setReconnecting] = useState(false);

  const focusName = useMemo(() => friendlyPrimitiveName(activePrimitiveType), [activePrimitiveType]);

  // Transient celebration when Pip finishes saying something.
  const [reacting, setReacting] = useState(false);
  const prevConvoLen = useRef(conversation.length);
  useEffect(() => {
    const grew = conversation.length > prevConvoLen.current;
    const last = conversation[conversation.length - 1];
    prevConvoLen.current = conversation.length;
    if (grew && last?.role === 'assistant' && !isAIResponding) {
      setReacting(true);
      const t = setTimeout(() => setReacting(false), 2000);
      return () => clearTimeout(t);
    }
  }, [conversation, isAIResponding]);

  const mood: Mood = !isConnected
    ? 'sleeping'
    : isAIResponding
      ? 'thinking'
      : reacting
        ? 'excited'
        : 'happy';

  // Most recent thing Pip said — shown big in the bubble + read aloud via audio.
  const lastAssistant = useMemo(() => {
    for (let i = conversation.length - 1; i >= 0; i--) {
      if (conversation[i].role === 'assistant') return conversation[i].content;
    }
    return null;
  }, [conversation]);

  // ── Derive live next-step choices from the active primitive's scaffold ──
  const prompts = useMemo<ConsolePrompt[]>(() => {
    const data = (activePrimitiveData ?? {}) as Record<string, unknown>;
    const scaffold = activePrimitiveType ? getComponentById(activePrimitiveType)?.tutoring : undefined;

    const authored = (scaffold?.studentPrompts ?? [])
      .filter((p) => passesShowWhen(p, data))
      .map<ConsolePrompt>((p) => ({
        kind: p.kind,
        hintLevel: p.hintLevel,
        label: interpolateTemplate(p.label, data),
        prompt: p.prompt ? interpolateTemplate(p.prompt, data) : undefined,
      }))
      .filter((p) => !p.label.includes('(not set)'));

    if (authored.length > 0) return authored.slice(0, 3); // K-5: never more than 3 choices

    if (scaffold) {
      const hints: ConsolePrompt[] = scaffold.scaffoldingLevels
        ? [{ label: 'Give me a hint', kind: 'hint', hintLevel: 1 }]
        : [];
      return [
        ...hints,
        { label: 'Show me how', kind: 'explain', prompt: 'Can you explain what I should be doing here?' },
      ];
    }
    return [];
  }, [activePrimitiveType, activePrimitiveData]);

  const onTap = (p: ConsolePrompt) => {
    if (isAIResponding) return;
    if (p.kind === 'hint') requestHint(p.hintLevel ?? 1);
    else sendText(p.prompt ?? p.label, { silent: false });
  };

  const handleSendText = () => {
    const trimmed = text.trim();
    if (!trimmed || isAIResponding) return;
    sendText(trimmed, { silent: false });
    setText('');
  };

  const handleReconnect = async () => {
    if (reconnecting) return;
    setReconnecting(true);
    try {
      await reconnect();
    } finally {
      setReconnecting(false);
    }
  };

  // What Pip is "saying" right now.
  const bubbleText: string | null = !isConnected
    ? sessionEnded
      ? "Let's keep going!"
      : 'Waking up…'
    : isAIResponding
      ? null // animated dots instead
      : lastAssistant ?? (focusName ? `Let's look at the ${focusName}!` : 'Tap a bubble and I can help!');

  // ── Collapsed: Pip peeks from the corner ──
  if (!expanded) {
    return (
      <div className="fixed bottom-5 right-5 z-40">
        <button
          onClick={() => setExpanded(true)}
          aria-label="Open Pip, your helper"
          className="rounded-full transition-transform hover:scale-105 active:scale-95"
        >
          <PipCharacter mood={mood} talking={isAIResponding} size={64} />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 flex w-[20rem] flex-col items-end gap-3">
      {/* Speech bubble — large, read-aloud */}
      <AnimatePresence mode="wait">
        <motion.div
          key={bubbleText ?? 'thinking'}
          initial={{ opacity: 0, y: 12, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="relative w-full rounded-3xl rounded-br-md border border-cyan-300/30 bg-slate-900/95 p-4 shadow-[0_8px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl"
        >
          {/* close */}
          <button
            onClick={() => setExpanded(false)}
            aria-label="Hide Pip"
            className="absolute -right-2 -top-2 rounded-full border border-white/10 bg-slate-800 p-1 text-slate-400 transition-colors hover:text-slate-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          {isAIResponding ? (
            <div className="flex items-center gap-1.5 py-1">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="h-2.5 w-2.5 rounded-full bg-cyan-300"
                  animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
                />
              ))}
            </div>
          ) : (
            <p className="max-h-40 overflow-y-auto whitespace-pre-wrap text-[15px] font-medium leading-snug text-slate-100">
              {bubbleText}
            </p>
          )}

          {sessionEnded && !isConnected && (
            <button
              onClick={handleReconnect}
              disabled={reconnecting}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-300/40 bg-cyan-500/20 py-2.5 text-sm font-bold text-cyan-100 transition-colors hover:bg-cyan-500/30 disabled:opacity-50"
            >
              {reconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {reconnecting ? 'Waking up…' : 'Wake Pip up'}
            </button>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Big emoji choice bubbles — the centerpiece */}
      {isConnected && (
        <div className="flex w-full flex-col gap-2">
          <AnimatePresence mode="popLayout">
            {prompts.map((p, i) => (
              <motion.button
                key={`${p.kind}-${p.label}`}
                layout
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                transition={{ duration: 0.2, delay: i * 0.05, ease: 'easeOut' }}
                disabled={isAIResponding}
                onClick={() => onTap(p)}
                className={`flex items-center gap-3 rounded-2xl border bg-gradient-to-r ${KIND_GRADIENT[p.kind]} px-4 py-3 text-left shadow-lg backdrop-blur-md transition-all hover:-translate-y-0.5 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40`}
              >
                <span className="text-2xl leading-none" aria-hidden>
                  {KIND_EMOJI[p.kind]}
                </span>
                <span className="flex-1 text-[15px] font-bold text-slate-50">{p.label}</span>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Pip + voice-first controls */}
      <div className="flex w-full items-end justify-between gap-2">
        <PipCharacter mood={mood} talking={isAIResponding} size={92} />

        {isConnected && (
          <div className="flex flex-col items-center gap-1.5">
            {/* Hold-to-talk — the primary input for young learners */}
            <button
              onPointerDown={() => startListening()}
              onPointerUp={() => stopListening()}
              onPointerLeave={() => isListening && stopListening()}
              aria-label="Hold to talk to Pip"
              className={`relative flex h-16 w-16 items-center justify-center rounded-full border-2 shadow-xl transition-all active:scale-95 ${
                isListening
                  ? 'border-rose-300 bg-rose-500'
                  : 'border-cyan-300/50 bg-gradient-to-br from-cyan-500 to-indigo-600 hover:scale-105'
              }`}
            >
              {isListening && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60" />
              )}
              <Mic className="relative h-7 w-7 text-white" />
            </button>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {isListening ? 'Listening…' : 'Hold to talk'}
            </span>
          </div>
        )}
      </div>

      {/* Advanced (older grades / accessibility): type + transcript, tucked away */}
      {isConnected && (
        <div className="w-full">
          <button
            onClick={() => setShowAdvanced((s) => !s)}
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 transition-colors hover:text-slate-300"
          >
            <MessageSquare className="h-3 w-3" />
            {showAdvanced ? 'Hide typing' : 'Type instead'}
          </button>
          {showAdvanced && (
            <div className="mt-2 flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/90 p-2 backdrop-blur-md">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
                placeholder="Ask Pip…"
                disabled={isAIResponding}
                className="flex-1 bg-transparent px-2 py-1 text-sm text-slate-100 placeholder-slate-500 focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={handleSendText}
                disabled={!text.trim() || isAIResponding}
                className="rounded-xl bg-cyan-600/80 p-2 transition-colors hover:bg-cyan-600 disabled:opacity-40"
                aria-label="Send"
              >
                <Send className="h-4 w-4 text-white" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
