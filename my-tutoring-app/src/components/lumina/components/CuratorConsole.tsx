'use client';

/**
 * CuratorConsole — the live, generative-UI tutoring surface.
 *
 * Lumina is an interactive app first; the Curator is NOT a mic. Its job is to
 * read the *live* primitive state (via LuminaAIContext) and surface tappable
 * "next step" buttons grounded in each primitive's authored tutoring scaffold
 * (`studentPrompts`). Labels/visibility interpolate from live primitive_data,
 * so the buttons adapt as the student works — generative-feeling without free
 * LLM generation.
 *
 * Tapping a button drives the existing lesson-mode Gemini Live session:
 *   - kind 'hint'  → requestHint(level)  (tiered scaffold)
 *   - otherwise    → sendText(prompt)    (student-voiced; the AI speaks back)
 *
 * Audio OUTPUT (the AI speaking) is handled by the context. Mic INPUT is
 * intentionally secondary — a small push-to-talk affordance, not the centerpiece.
 *
 * Must be rendered inside <LuminaAIProvider> (i.e. within LessonScreen).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import { getComponentById } from '../service/manifest/catalog';
import { getPrimitive } from '../config/primitiveRegistry';
import { interpolateTemplate } from '../utils/interpolateTemplate';
import type { ComponentId, StudentPrompt, StudentPromptKind } from '../types';
import { LuminaButton } from '../ui';
import {
  Sparkles,
  Lightbulb,
  HelpCircle,
  CheckCircle2,
  ArrowRight,
  Send,
  Mic,
  MicOff,
  ChevronDown,
  MessageSquare,
  Loader2,
  Target,
} from 'lucide-react';

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

// ── Kind → presentation ─────────────────────────────────────────────────────
const KIND_TONE: Record<StudentPromptKind, 'subtle' | 'ghost' | 'primary'> = {
  hint: 'subtle',
  explain: 'ghost',
  check: 'primary',
  advance: 'primary',
};

const KindIcon: React.FC<{ kind: StudentPromptKind; className?: string }> = ({
  kind,
  className = 'w-4 h-4 shrink-0',
}) => {
  switch (kind) {
    case 'hint':
      return <Lightbulb className={className} />;
    case 'explain':
      return <HelpCircle className={className} />;
    case 'check':
      return <CheckCircle2 className={className} />;
    case 'advance':
      return <ArrowRight className={className} />;
  }
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

interface CuratorConsoleProps {
  defaultExpanded?: boolean;
}

export const CuratorConsole: React.FC<CuratorConsoleProps> = ({ defaultExpanded = true }) => {
  const ctx = useLuminaAIContext();
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
  } = ctx;

  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showTranscript, setShowTranscript] = useState(false);
  const [text, setText] = useState('');

  // Which on-screen primitive the Curator is anchored to (follows viewport).
  const focusName = useMemo(
    () => friendlyPrimitiveName(activePrimitiveType),
    [activePrimitiveType],
  );

  // Synthetic visualizer pulse while the AI is responding (the lesson session
  // doesn't expose an output analyser node, so we approximate motion).
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!isAIResponding) return;
    const id = setInterval(() => setTick((t) => t + 1), 120);
    return () => clearInterval(id);
  }, [isAIResponding]);

  // Derive the live next-step buttons from the active primitive's scaffold.
  const prompts = useMemo<ConsolePrompt[]>(() => {
    const data = (activePrimitiveData ?? {}) as Record<string, unknown>;
    const scaffold = activePrimitiveType
      ? getComponentById(activePrimitiveType)?.tutoring
      : undefined;

    const authored = (scaffold?.studentPrompts ?? [])
      .filter((p) => passesShowWhen(p, data))
      .map<ConsolePrompt>((p) => ({
        kind: p.kind,
        hintLevel: p.hintLevel,
        label: interpolateTemplate(p.label, data),
        prompt: p.prompt ? interpolateTemplate(p.prompt, data) : undefined,
      }))
      // Drop buttons whose label still has an unresolved {{key}} → '(not set)'.
      .filter((p) => !p.label.includes('(not set)'));

    if (authored.length > 0) return authored;

    // Fallback so the console is never blank when a scaffold is present but has
    // no studentPrompts authored yet.
    if (scaffold) {
      const hints: ConsolePrompt[] = scaffold.scaffoldingLevels
        ? [
            { label: 'Give me a hint', kind: 'hint', hintLevel: 1 },
            { label: 'I need more help', kind: 'hint', hintLevel: 2 },
            { label: 'Walk me through it', kind: 'hint', hintLevel: 3 },
          ]
        : [];
      return [
        ...hints,
        {
          label: 'Explain this to me',
          kind: 'explain',
          prompt: 'Can you explain what I should be doing here?',
        },
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

  // Collapsed pill — minimized but still alive.
  if (!expanded) {
    return (
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setExpanded(true)}
          className="group flex items-center gap-2.5 rounded-full border border-cyan-400/30 bg-slate-900/90 px-4 py-3 shadow-2xl backdrop-blur-md transition-all hover:-translate-y-0.5 hover:border-cyan-300/50"
        >
          <span className="relative flex h-2.5 w-2.5">
            {(isAIResponding || isConnected) && (
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                  isAIResponding ? 'bg-cyan-400' : 'bg-emerald-400'
                }`}
              />
            )}
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                isConnected ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
          </span>
          <Sparkles className="h-4 w-4 text-cyan-300" />
          <span className="text-sm font-semibold text-cyan-100">Curator</span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 w-[22rem] animate-fade-in-up">
      <div className="flex flex-col gap-4 rounded-3xl border border-cyan-500/30 bg-slate-900/95 p-5 shadow-[0_0_50px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              {(isAIResponding || isConnected) && (
                <span
                  className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                    isAIResponding ? 'bg-cyan-400' : 'bg-emerald-400'
                  }`}
                />
              )}
              <span
                className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                  isConnected ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
            </span>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-cyan-300" />
                <span className="text-xs font-bold uppercase tracking-widest text-cyan-200">
                  Curator
                </span>
              </div>
              {isConnected && focusName && (
                <span className="flex items-center gap-1 text-[10px] text-slate-400">
                  <Target className="h-2.5 w-2.5 text-cyan-400/70" />
                  Helping with{' '}
                  <span className="font-medium text-slate-300">{focusName}</span>
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => setExpanded(false)}
            className="-m-2 rounded-full p-2 text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-300"
            title="Minimize"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>

        {/* Status + visualizer */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 flex-1 items-center justify-center gap-1.5 overflow-hidden rounded-xl border border-white/5 bg-black/40">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="w-1.5 rounded-full bg-gradient-to-t from-cyan-600 to-cyan-200 transition-all duration-100 ease-out"
                style={{
                  height: isAIResponding
                    ? `${25 + 55 * Math.abs(Math.sin(tick * 0.5 + i * 1.7))}%`
                    : '14%',
                  opacity: isAIResponding ? 0.9 : 0.4,
                }}
              />
            ))}
          </div>
          <p className="w-20 text-right text-xs font-medium text-slate-400">
            {!isConnected ? 'Connecting…' : isAIResponding ? 'Speaking…' : 'Ready'}
          </p>
        </div>

        {/* Next-step buttons — the centerpiece */}
        <div className="flex flex-col gap-2.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Next steps
          </span>
          {!isConnected ? (
            <div className="flex items-center gap-2 px-1 py-2 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Waking up the Curator…
            </div>
          ) : prompts.length === 0 ? (
            <p className="px-1 py-2 text-xs text-slate-500">
              Keep exploring — I&apos;ll jump in when there&apos;s something to help with.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {prompts.map((p, i) => (
                <LuminaButton
                  key={`${p.kind}-${i}`}
                  tone={KIND_TONE[p.kind]}
                  disabled={isAIResponding}
                  onClick={() => onTap(p)}
                  className="h-auto justify-start gap-2.5 whitespace-normal py-2.5 text-left text-sm"
                >
                  <KindIcon kind={p.kind} />
                  <span className="flex-1">{p.label}</span>
                </LuminaButton>
              ))}
            </div>
          )}
        </div>

        {/* Transcript (collapsible) */}
        {isConnected && (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setShowTranscript((s) => !s)}
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 transition-colors hover:text-slate-300"
            >
              <MessageSquare className="h-3 w-3" />
              {showTranscript ? 'Hide conversation' : 'Show conversation'}
              {conversation.length > 0 && (
                <span className="text-slate-600">({conversation.length})</span>
              )}
            </button>
            {showTranscript && (
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-white/5 bg-black/30 p-2">
                {conversation.length === 0 && (
                  <p className="py-3 text-center text-xs text-slate-600">
                    Tap a next step or ask me anything.
                  </p>
                )}
                {conversation.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg p-2 ${
                        msg.role === 'user'
                          ? 'bg-cyan-600/80 text-white'
                          : 'border border-white/10 bg-slate-800 text-slate-200'
                      }`}
                    >
                      <p className="whitespace-pre-wrap text-xs">{msg.content}</p>
                      {msg.isAudio && (
                        <span className="mt-1 flex items-center gap-1 text-[10px] opacity-60">
                          <Mic className="h-3 w-3" /> Voice
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {isAIResponding && (
                  <div className="flex justify-start">
                    <div className="rounded-lg border border-white/10 bg-slate-800 p-2">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span className="text-xs">Thinking…</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer: text + push-to-talk (secondary) */}
        {isConnected && (
          <div className="flex items-center gap-2 border-t border-white/5 pt-3">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
              placeholder="Ask the Curator…"
              disabled={isAIResponding}
              className="flex-1 rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={handleSendText}
              disabled={!text.trim() || isAIResponding}
              className="rounded-lg bg-cyan-600/80 p-1.5 transition-colors hover:bg-cyan-600 disabled:opacity-40"
              title="Send"
            >
              <Send className="h-3.5 w-3.5 text-white" />
            </button>
            <button
              onClick={() => (isListening ? stopListening() : startListening())}
              className={`rounded-lg p-1.5 transition-colors ${
                isListening ? 'bg-rose-600 hover:bg-rose-700' : 'bg-white/5 hover:bg-white/10'
              }`}
              title={isListening ? 'Stop talking' : 'Push to talk'}
            >
              {isListening ? (
                <MicOff className="h-3.5 w-3.5 text-white" />
              ) : (
                <Mic className="h-3.5 w-3.5 text-slate-300" />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
