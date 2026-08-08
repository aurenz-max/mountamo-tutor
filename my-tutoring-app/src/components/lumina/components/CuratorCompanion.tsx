'use client';

/**
 * CuratorCompanion — the K-5-native face of the Curator.
 *
 * Same brain as {@link CuratorConsole} (it reads the live primitive state via
 * LuminaAIContext and surfaces grounded, tappable next-steps from each
 * primitive's authored `studentPrompts`), but a *body* instead of a chat panel.
 *
 * For a 5-to-10-year-old a docked message box reads as "the thing grown-ups
 * type into". So here the helper is an embodied character — "Pip" (see
 * {@link PipCharacter}) — who lives IN the lesson, emotes, speaks in a large
 * read-aloud bubble, and offers a *small* number of huge emoji-forward choice
 * bubbles. Voice-first: the lesson mic stays open; typing/transcript hide behind
 * an "advanced" toggle for older grades and accessibility.
 *
 * ── Two placements ────────────────────────────────────────────────────────
 * PERCHED (default in a lesson): Pip sits on the top-right rim of whatever
 * primitive the student is working on, its shadow falling on the card, and hops
 * across when they move to the next one — see {@link usePerchAnchor}. Speech
 * appears beside it, in the empty band above the card, so the character and its
 * voice stay together. This is the cheap half of deixis: not "Pip points at the
 * bucket", but at least "Pip is HERE, at this thing, with you".
 *
 * DOCKED (fallback): the bottom-right stack, used whenever perching would be
 * worse than a corner — no active card, viewport too narrow, session asleep.
 *
 * The choice tray stays docked in BOTH placements. It is three big targets that
 * would otherwise cover the card the student is reading, and unlike speech it
 * is persistent — a menu, not an utterance.
 *
 * ── The three signals that drive the face ─────────────────────────────────
 *   isAudioPlaying → Pip's mouth. NOT isAIResponding: that flag falls when the
 *     model finishes generating, while the audio tail keeps playing for seconds
 *     afterward. Driving the mouth from it left Pip stone-faced mid-sentence.
 *   micLevel       → Pip's halo. The lesson mic is always open, so the only
 *     honest "I can hear you" signal is the character reacting to the child's
 *     actual voice. Debounced (see useHeardVoice) or it strobes between words.
 *   isAIResponding → the thinking pose, only until audio starts.
 *
 * Must be rendered inside <LuminaAIProvider> (i.e. within LessonScreen).
 *
 * NEXT (not yet built): true deictic gesture — Pip leaning toward, or pointing
 * at, the actual bucket/arm inside the diagram. That needs primitives to publish
 * spatial anchors the way sections publish data-primitive-instance-id.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import { getComponentById } from '../service/manifest/catalog';
import { getPrimitive } from '../config/primitiveRegistry';
import { interpolateTemplate } from '../utils/interpolateTemplate';
import { usePerchAnchor } from '../hooks/usePerchAnchor';
import { PipCharacter, type PipMood } from './PipCharacter';
import type { ComponentId, StudentPrompt, StudentPromptKind } from '../types';
import { Mic, MicOff, Send, RefreshCw, Loader2, MessageSquare, X } from 'lucide-react';

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

/** Mic RMS above which we call it "the student is talking" (noise floor is ~0.005). */
const VOICE_FLOOR = 0.015;
/** How long the listening pose survives a gap between words. */
const VOICE_TAIL_MS = 700;
/** How long a finished utterance stays readable in the perched bubble. */
const SPEECH_LINGER_MS = 6000;

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

/**
 * Debounced "the student is actually speaking". micLevel is a per-audio-frame
 * RMS, so raw thresholding flips several times per word and Pip's face strobes.
 * The tail keeps the listening pose alive across the gaps inside a sentence.
 */
function useHeardVoice(level: number, active: boolean): boolean {
  const [speaking, setSpeaking] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active) {
      setSpeaking(false);
      return;
    }
    if (level > VOICE_FLOOR) {
      setSpeaking(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setSpeaking(false), VOICE_TAIL_MS);
    }
  }, [level, active]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return speaking;
}

interface CuratorCompanionProps {
  defaultExpanded?: boolean;
}

export const CuratorCompanion: React.FC<CuratorCompanionProps> = ({ defaultExpanded = true }) => {
  const {
    isConnected,
    isAIResponding,
    isAudioPlaying,
    conversation,
    activePrimitiveId,
    activePrimitiveType,
    activePrimitiveData,
    sendText,
    requestHint,
    startListening,
    stopListening,
    isListening,
    micLevel,
    sessionEnded,
    reconnect,
  } = useLuminaAIContext();

  const reduced = useReducedMotion();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [text, setText] = useState('');
  const [reconnecting, setReconnecting] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  const focusName = useMemo(() => friendlyPrimitiveName(activePrimitiveType), [activePrimitiveType]);
  const studentTalking = useHeardVoice(micLevel, isConnected && isListening);

  // Where Pip is standing. Null ⇒ nothing worth sitting on; use the corner dock.
  const perch = usePerchAnchor(activePrimitiveId, expanded && isConnected);
  const perched = perch !== null;

  // Transient celebration — fired when Pip finishes speaking, and on a poke.
  const [reacting, setReacting] = useState(false);
  const reactTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const celebrate = useCallback((ms = 2000) => {
    setReacting(true);
    if (reactTimer.current) clearTimeout(reactTimer.current);
    reactTimer.current = setTimeout(() => setReacting(false), ms);
  }, []);
  useEffect(() => () => { if (reactTimer.current) clearTimeout(reactTimer.current); }, []);

  const prevConvoLen = useRef(conversation.length);
  useEffect(() => {
    const grew = conversation.length > prevConvoLen.current;
    const last = conversation[conversation.length - 1];
    prevConvoLen.current = conversation.length;
    if (grew && last?.role === 'assistant') {
      if (!expanded) setHasUnread(true);
      if (!isAIResponding) celebrate(2000);
    }
  }, [conversation, isAIResponding, expanded, celebrate]);

  // Perched speech is transient: a bubble parked over the card's header forever
  // would just be occlusion. It opens while Pip works, then lingers long enough
  // to be read. (The dock has room to keep the last line up indefinitely.)
  const [speechLive, setSpeechLive] = useState(false);
  useEffect(() => {
    if (isAIResponding || isAudioPlaying || studentTalking) {
      setSpeechLive(true);
      return;
    }
    if (!speechLive) return;
    const t = setTimeout(() => setSpeechLive(false), SPEECH_LINGER_MS);
    return () => clearTimeout(t);
  }, [isAIResponding, isAudioPlaying, studentTalking, speechLive]);

  // Mood priority: asleep → speaking → thinking → celebrating → hearing you → idle.
  // Speaking must outrank thinking; isAIResponding stays true across the whole
  // audio tail, and a "thinking" face while Pip audibly talks reads as broken.
  const mood: PipMood = !isConnected
    ? 'sleeping'
    : isAudioPlaying
      ? 'speaking'
      : isAIResponding
        ? 'thinking'
        : reacting
          ? 'excited'
          : studentTalking
            ? 'listening'
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

  const handleReconnect = useCallback(async () => {
    if (reconnecting) return;
    setReconnecting(true);
    try {
      await reconnect();
    } finally {
      setReconnecting(false);
    }
  }, [reconnecting, reconnect]);

  const openPanel = () => {
    setExpanded(true);
    setHasUnread(false);
  };

  /**
   * Tapping the character. Asleep it wakes the session — the affordance a
   * 5-year-old reaches for before they read the button. Awake it is deliberately
   * a LOCAL delight only: no turn is sent, so poking Pip costs nothing and can
   * never interrupt a lesson.
   */
  const handlePoke = () => {
    if (!isConnected) {
      if (sessionEnded) void handleReconnect();
      return;
    }
    celebrate(1400);
  };

  // What Pip is "saying" right now.
  const bubbleText: string | null = !isConnected
    ? sessionEnded
      ? "Let's keep going!"
      : 'Waking up…'
    : isAIResponding && !isAudioPlaying && !lastAssistant
      ? null // animated dots instead
      : studentTalking
        ? "I'm listening…"
        : lastAssistant ?? (focusName ? `Let's look at the ${focusName}!` : 'Tap a bubble and I can help!');

  const thinkingDots = (
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
  );

  // ── Collapsed: Pip peeks from the corner ──
  if (!expanded) {
    return (
      <div className="fixed bottom-5 right-5 z-40">
        <button
          onClick={openPanel}
          aria-label={hasUnread ? 'Open Pip, your helper — Pip said something' : 'Open Pip, your helper'}
          className="relative rounded-full transition-transform hover:scale-105 active:scale-95"
        >
          <PipCharacter mood={mood} level={micLevel} size={76} trackPointer={false} />
          {hasUnread && (
            <motion.span
              className="absolute right-1 top-1 h-4 w-4 rounded-full border-2 border-slate-900 bg-amber-400"
              animate={{ scale: [1, 1.25, 1] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
        </button>
      </div>
    );
  }

  return (
    <>
      {/* ── PERCHED: Pip rides the active card's rim ───────────────────────
          The wrapper is anchored at the rim point and its contents grow up and
          to the LEFT (-translate-*-full), so speech fills the empty band above
          the card instead of covering it. Pip is nudged back down so its lower
          third — and its ground shadow — land on the card itself. */}
      {perched && (
        <motion.div
          className="pointer-events-none fixed left-0 top-0 z-40"
          initial={false}
          animate={{ x: perch.x, y: perch.y }}
          transition={
            reduced
              ? { duration: 0 }
              : { type: 'spring', stiffness: 170, damping: 20, mass: 0.9 }
          }
        >
          <div className="flex -translate-x-full -translate-y-full items-end gap-2">
            <AnimatePresence mode="wait">
              {speechLive && (
                <motion.div
                  key={bubbleText ?? 'thinking'}
                  initial={{ opacity: 0, y: 8, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.96 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="pointer-events-auto max-w-[17rem] rounded-3xl rounded-br-md border border-cyan-300/30 bg-slate-900/95 px-4 py-3 shadow-[0_8px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl"
                >
                  {bubbleText === null ? (
                    thinkingDots
                  ) : (
                    <p className="max-h-28 overflow-y-auto whitespace-pre-wrap text-[15px] font-medium leading-snug text-slate-100">
                      {bubbleText}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="pointer-events-auto translate-y-[36%]">
              <PipCharacter mood={mood} level={micLevel} size={108} onPoke={handlePoke} />
            </div>
          </div>
        </motion.div>
      )}

      {/* ── DOCKED: speech (when not perched), the choice tray, mic, typing ── */}
      <div className="fixed bottom-5 right-5 z-40 flex w-[22rem] flex-col items-end gap-3">
        <button
          onClick={() => setExpanded(false)}
          aria-label="Hide Pip"
          className="rounded-full border border-white/10 bg-slate-800/80 p-1.5 text-slate-400 backdrop-blur-md transition-colors hover:text-slate-200"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {!perched && (
          <AnimatePresence mode="wait">
            <motion.div
              key={bubbleText ?? 'thinking'}
              initial={{ opacity: 0, y: 12, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="relative w-full rounded-3xl rounded-br-md border border-cyan-300/30 bg-slate-900/95 p-4 shadow-[0_8px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl"
            >
              {bubbleText === null ? (
                thinkingDots
              ) : (
                <p className="max-h-40 overflow-y-auto whitespace-pre-wrap text-[16px] font-medium leading-relaxed text-slate-100">
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
        )}

        {/* Big emoji choice bubbles — the centerpiece. Docked in both placements:
            three targets this size would cover the card Pip is sitting on. */}
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

        {/* Pip (only when it has nowhere to perch) + voice-first controls */}
        <div className={`flex w-full items-end gap-2 ${perched ? 'justify-end' : 'justify-between'}`}>
          {!perched && <PipCharacter mood={mood} level={micLevel} size={!isConnected ? 152 : 124} onPoke={handlePoke} />}

          {isConnected && (
            <div className="flex flex-col items-center gap-1.5">
              {/* Lesson-wide open mic; this control only pauses or resumes it. */}
              <button
                onClick={() => (isListening ? stopListening() : startListening())}
                aria-label={isListening ? 'Pause the lesson microphone' : 'Resume the lesson microphone'}
                className={`relative flex h-16 w-16 items-center justify-center rounded-full border-2 shadow-xl transition-all active:scale-95 ${
                  isListening
                    ? 'border-rose-300 bg-rose-500'
                    : 'border-cyan-300/50 bg-gradient-to-br from-cyan-500 to-indigo-600 hover:scale-105'
                }`}
              >
                {/* Level-reactive ring rather than a constant ping: it agrees with
                    Pip's halo, so both surfaces answer "can it hear me?" the same way. */}
                {isListening && (
                  <motion.span
                    className="absolute inset-0 rounded-full bg-rose-400"
                    animate={{
                      scale: 1 + Math.min(1, micLevel / 0.12) * 0.45,
                      opacity: 0.18 + Math.min(1, micLevel / 0.12) * 0.45,
                    }}
                    transition={{ duration: 0.12, ease: 'linear' }}
                  />
                )}
                {isListening
                  ? <Mic className="relative h-7 w-7 text-white" />
                  : <MicOff className="relative h-7 w-7 text-white" />}
              </button>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {isListening ? 'Open mic' : 'Mic paused'}
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
    </>
  );
};
