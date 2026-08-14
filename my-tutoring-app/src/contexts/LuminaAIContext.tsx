'use client';

import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import AudioCaptureService from '@/lib/AudioCaptureService';
import { useAudioPlayback } from '@/lib/hooks/useAudioPlayback';
import { useExhibitContext } from '@/components/lumina/contexts/ExhibitContext';
import { useEvaluationContext } from '@/components/lumina/evaluation';
import type { AudioInputConfig, ManifestItem, ObjectiveData, TutoringScaffold } from '@/components/lumina/types';
import { getComponentById } from '@/components/lumina/service/manifest/catalog';
import { getClientRunId } from '@/components/lumina/service/clientRunId';
import {
  useLiveVoiceTurnsWithTransport,
  type LiveVoiceTurns,
} from '@/components/lumina/hooks/useLiveVoiceTurns';
import type { VoiceTurnEvent } from '@/components/lumina/hooks/voiceTurnMachine';
import {
  resolveLessonAudioInput,
  resolveLessonVoiceTurnConfig,
} from '@/components/lumina/hooks/lessonVoiceTurnPolicy';

// Message type from AI
interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isAudio?: boolean;
}

// Primitive context for connection
interface PrimitiveContext {
  primitive_type: string;
  instance_id: string;
  primitive_data: any;
  student_id?: number;
  exhibit_id?: string;
  topic?: string;
  grade_level?: string;
  /** Override the catalog tutoring scaffold for this session. Dev benches use
   *  this to install a custom persona (e.g. the DI script executor) without
   *  registering a catalog entry; primitives should omit it. */
  tutoring?: TutoringScaffold | null;
  /** Optional tuning of Gemini's automatic voice-activity detection for this
   *  session. Generic transport — the backend clamps values. Explicit override;
   *  when omitted, the connect paths fall back to the catalog entry's
   *  `audioInput` declaration (see AudioInputConfig in lumina/types). */
  audio_input?: AudioInputConfig | null;
  /**
   * THIS PRIMITIVE OWNS ITS OPENING LINE — the tutor must be SILENT until the
   * primitive's own first cue. Set by every pack whose first spoken words are a
   * hand-authored script (the Direct Instruction family and the DI-ported
   * literacy primitives); omit everywhere else.
   *
   * WHY IT EXISTS (DI-GREET-1, found live 2026-08-10 on word-flip). The backend
   * queues "Greet the student warmly…" with `end_of_turn: true` on every fresh
   * connect, so Gemini takes a turn immediately — while the client is still
   * waiting for the microphone and has not sent a cue yet. On word-flip that
   * produced 15s of improvised tutoring that ended with the tutor asking its
   * OWN question; the child answered it, which barged in over the scripted ask,
   * and item 1 ran with no question at all. It is the true root of residual
   * SWAP-1: removing the catalog's "compose a how-to-play" directive took one
   * job off that turn but could not remove the turn.
   */
  owns_opening?: boolean;
}

// Lesson context built from exhibit data
interface LessonContext {
  exhibit_id: string;
  topic: string;
  grade_level: string;
  objectives: Array<{
    id: string;
    text: string;
    verb: string;
  }>;
  ordered_components: Array<{
    component_id: string;
    instance_id: string;
    title: string;
    objective_ids?: string[];
  }>;
  current_index: number;
  previous_results: Array<{
    instance_id: string;
    component_id: string;
    completed: boolean;
    score?: number;
  }>;
}

// AI metrics for evaluation
interface AIMetrics {
  totalHints: number;
  totalInteractions: number;
  conversationTurns: number;
  voiceInteractions: number;
  timeWithAI: number;
  hintsGiven: {
    level1: number;
    level2: number;
    level3: number;
  };
}

// Session modes: idle (no session), standalone (per-primitive), lesson (per-exhibit)
export type SessionMode = 'idle' | 'standalone' | 'lesson';

// Info needed to start a lesson-mode session
export interface LessonConnectionInfo {
  exhibit_id: string;
  topic: string;
  grade_level: string;
  firstPrimitive: PrimitiveContext;
}

interface LuminaAIContextType {
  // Connection
  connect: (primitiveContext: PrimitiveContext) => Promise<void>;
  connectLesson: (info: LessonConnectionInfo) => Promise<void>;
  switchPrimitive: (primitiveContext: PrimitiveContext) => void;
  disconnect: () => void;
  /** Re-establish the most recent session (standalone or lesson) after it ended
   *  unexpectedly — e.g. Gemini Live hit its duration limit. No-op if there was
   *  never a session to restore. */
  reconnect: () => Promise<void>;
  isConnected: boolean;
  sessionMode: SessionMode;
  /** True once a session ended without the user disconnecting (server close /
   *  Gemini duration limit / network drop). Drives the reconnect affordance. */
  sessionEnded: boolean;
  /** Machine-readable cause of the last unexpected end (e.g.
   *  'gemini_session_closed', 'disconnected'), or null while connected. */
  sessionEndedReason: string | null;
  /** Monotonically increasing count of session RESUMES — bumped on every
   *  server `session_resumed`, which covers both transparent server-side
   *  Gemini resumes (GoAway / drop) and warm client-socket reconnects (the
   *  auth-supplied resumption handle makes the backend's first Gemini connect
   *  a resume too). A counter, not a callback: consumers effect-key on it, so
   *  a resume across an unmount/remount isn't lost. A resume restores the
   *  CONVERSATION, never the work in flight — consumers that had cued
   *  something re-cue it when this changes (DI BACKLOG item 5, fix (i)). */
  sessionResumeCount: number;
  /** Synchronous flag (ref) that a lesson session owns this provider. Primitives
   *  read it to suppress their standalone auto-connect and avoid racing it. */
  lessonModeRef: React.MutableRefObject<boolean>;
  activePrimitiveId: string | null;
  /** Catalog id (component type) of the active primitive — used to look up its tutoring scaffold. */
  activePrimitiveType: string | null;
  /** Live primitive_data for the active primitive — drives CuratorConsole button interpolation. */
  activePrimitiveData: Record<string, any> | null;

  // AI interaction
  requestHint: (level: 1 | 2 | 3, currentState?: any) => void;
  sendVoice: (audioData: string) => void;
  sendText: (text: string, options?: { silent?: boolean; interrupt?: boolean; scripted?: boolean }) => void;
  updateContext: (newState: any, progress?: any) => void;

  // State
  conversation: Message[];
  isAIResponding: boolean;
  /** True while tutor audio is still audibly playing (the audio tail can outlive isAIResponding). */
  isAudioPlaying: boolean;
  aiMetrics: AIMetrics;

  // Audio
  startListening: () => void;
  stopListening: () => void;
  isListening: boolean;
  /** Hold the shared activity bracket (gesture items) without muting the mic.
   *  Ref-counted; call the returned disposer to release. */
  holdVoiceTurns: () => () => void;
  /**
   * Live mic RMS — a SUBSCRIPTION, never a context value, and that distinction
   * is the whole point (DI BACKLOG 19b, fixed 2026-08-14).
   *
   * The level updates once per captured audio frame (~10-40ms). While it lived
   * on this value as `micLevel: number`, every open mic re-rendered the whole
   * provider 30-100×/sec, handed every consumer of `useLuminaAIContext()` a new
   * `ctx` identity at that rate, and churned every callback derived from one.
   * For state-driven effects that was waste; for TIME-based effects it was
   * fatal — a 1000ms interval torn down every 20ms never fires (that is exactly
   * how `verdictTimeoutMs` was dead for four DI ports; see the ⚠️ block in
   * `useJudgedSpeechLoop`). Nothing in the provider re-renders on a frame now.
   *
   * Subscribe if you PAINT the level (the mic orb, Pip's halo) — `useMicLevel()`
   * below wraps this so the render stays inside your own component. Read
   * `micLevelRef.current` if you only need the value at some other event's
   * moment. Never put it back on the value.
   */
  subscribeMicLevel: (listener: (level: number) => void) => () => void;
  /** Current mic RMS, readable synchronously without subscribing or rendering. */
  micLevelRef: React.MutableRefObject<number>;
  /** How often the mic level updates, in ms — one audio-capture frame.
   *  Consumers that measure DURATION from level samples are quantised to this
   *  and must account for it; 0 means not yet known (no audio context). */
  micFramePeriodMs: number;
  /** Manual voice-activity brackets. Only meaningful for sessions connected
   *  with audio_input.manual_activity; no-ops when the socket is closed. */
  sendActivityStart: () => void;
  sendActivityEnd: () => void;
  sharedVoiceTurns: LiveVoiceTurns & {
    subscribe: (listener: VoiceTurnListener) => () => void;
  };
}

interface VoiceTurnListener {
  onTurnOpen?: (event: Extract<VoiceTurnEvent, { kind: 'open' }>) => void;
  onTurnClose?: (event: Extract<VoiceTurnEvent, { kind: 'close' }>) => void;
}

const LuminaAIContext = createContext<LuminaAIContextType | null>(null);

// Static lesson/identity metadata that is framing, not live interaction state.
// It's already delivered in lesson_context at connect and in the switch_primitive
// scaffold. Re-sending it inside a [CONTEXT UPDATE] tells Gemini the student's
// state "changed" when it hasn't — which makes the tutor narrate on every render
// and appear to jump between primitives. We strip these before forwarding.
const STATIC_CONTEXT_KEYS = new Set([
  'title',
  'objectiveText',
  'objectiveId',
  'objectiveIds',
  'instanceId',
  'exhibitId',
  'skillId',
  'subskillId',
  'topic',
  'gradeLevel',
  'componentIntent',
]);

// How close together two IDENTICAL cues must land to be treated as one.
// StrictMode's double-invoke of a state updater is synchronous, so the copies
// arrive in the same tick (a real session logged pairs 0-2ms apart). Anything a
// student repeats on purpose — tapping 🔊 twice, re-asking — is an order of
// magnitude slower and still goes through.
const DUPLICATE_CUE_WINDOW_MS = 50;

// Hint requests are composed HERE, not on the server: the client owns the
// business logic and the server's wire protocol stays minimal (a hint is just
// words for the model, so it travels as `text`). The system prompt's HINT
// PROGRESSION SYSTEM section teaches the model what each level means; this is
// the per-request ask.
const HINT_GUIDANCE: Record<1 | 2 | 3, string> = {
  1: 'Give a gentle nudge - ask a thought-provoking question or point them in the right direction.',
  2: 'Give specific guidance - break down the problem into smaller steps they can tackle.',
  3: 'Give a detailed walkthrough - guide them step-by-step without revealing the answer directly.',
};

export const LuminaAIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const socketRef = useRef<WebSocket | null>(null);
  const audioServiceRef = useRef<AudioCaptureService | null>(null);
  const currentPrimitiveRef = useRef<PrimitiveContext | null>(null);
  // Synchronous flag: a lesson session is being (or has been) established.
  // sessionMode state only flips to 'lesson' inside the async socket-open
  // callback, so during the initial mount it's still 'idle' — long enough for
  // every primitive's standalone auto-connect to race the lesson and clobber
  // the shared socket (last primitive wins → session stuck in standalone on the
  // bottom primitive). Primitives read this ref to stand down immediately.
  const lessonModeRef = useRef(false);
  const sessionStartTimeRef = useRef<number>(0);

  // Gemini session-resumption handle, forwarded by the backend as it rolls.
  // latestHandleRef = the newest handle for the live session; resumeWithHandleRef
  // = the handle to send on the NEXT connect attempt. reconnect() copies latest
  // into resumeWith so a dropped client socket resumes warm; a fresh connect
  // leaves resumeWith null and starts cold.
  const latestHandleRef = useRef<string | null>(null);
  const resumeWithHandleRef = useRef<string | null>(null);

  // Remembers how to rebuild the most recent session so reconnect() can re-run
  // the exact same connect path after an unexpected end.
  const lastConnectionRef = useRef<
    | { mode: 'standalone'; ctx: PrimitiveContext }
    | { mode: 'lesson'; info: LessonConnectionInfo }
    | null
  >(null);

  // Use the proven queued audio playback hook
  const { processAndPlayRawAudio, stopAudioPlayback, resetForNextTurn, isAudioPlaying } = useAudioPlayback({ sampleRate: 24000 });

  // Call hooks at top level (Rules of Hooks) and store in refs for use in callbacks
  const exhibitContext = useExhibitContext();
  const evaluationContext = useEvaluationContext();
  const exhibitContextRef = useRef(exhibitContext);
  const evaluationContextRef = useRef(evaluationContext);
  exhibitContextRef.current = exhibitContext;
  evaluationContextRef.current = evaluationContext;

  const [isConnected, setIsConnected] = useState(false);
  const [isAIResponding, setIsAIResponding] = useState(false);
  const [conversation, setConversation] = useState<Message[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [micFramePeriodMs, setMicFramePeriodMs] = useState(0);

  // ── Mic level: a per-frame signal that must never become a render ──────────
  // See LuminaAIContextType.subscribeMicLevel for why this is not state. The
  // publish is synchronous and outside React entirely: the turn machine steps
  // on the frame it arrives, and only components that PAINT the level pay a
  // render for it (via useMicLevel).
  const micLevelRef = useRef(0);
  const micLevelListenersRef = useRef(new Set<(level: number) => void>());
  const publishMicLevel = useCallback((level: number) => {
    micLevelRef.current = level;
    micLevelListenersRef.current.forEach((listener) => {
      // Isolated per listener BECAUSE the set is mixed: the voice-turn machine
      // — the thing that decides a child's answer was heard at all — shares it
      // with purely decorative orbs, in unpredictable subscribe order. One
      // throwing halo must never make the session deaf.
      try {
        listener(level);
      } catch (error) {
        console.error('Lumina mic-level subscriber threw:', error);
      }
    });
  }, []);
  const subscribeMicLevel = useCallback((listener: (level: number) => void) => {
    micLevelListenersRef.current.add(listener);
    return () => {
      micLevelListenersRef.current.delete(listener);
    };
  }, []);

  // Unexpected-end tracking. sessionEnded flips true on a server/Gemini close or
  // network drop (NOT on a user-initiated disconnect), so the UI can offer a
  // reconnect instead of sitting on a perpetual "Connecting…".
  const [sessionEnded, setSessionEnded] = useState(false);
  const [sessionEndedReason, setSessionEndedReason] = useState<string | null>(null);
  // Consumer-visible resume signal — see LuminaAIContextType.sessionResumeCount.
  const [sessionResumeCount, setSessionResumeCount] = useState(0);

  // Session mode and active primitive tracking
  const [sessionMode, setSessionMode] = useState<SessionMode>('idle');
  const [activePrimitiveId, setActivePrimitiveId] = useState<string | null>(null);
  const activePrimitiveIdRef = useRef<string | null>(null);
  // Active primitive type + live data, mirrored for the CuratorConsole's
  // generative next-step buttons. Kept in sync with setActivePrimitiveId calls
  // and refreshed by updateContext as the student interacts.
  const [activePrimitiveType, setActivePrimitiveType] = useState<string | null>(null);
  const [activePrimitiveData, setActivePrimitiveData] = useState<Record<string, any> | null>(null);

  const sendActivitySignal = useCallback((kind: 'activity_start' | 'activity_end') => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: kind }));
    }
  }, []);
  const sendActivityStart = useCallback(() => sendActivitySignal('activity_start'), [sendActivitySignal]);
  const sendActivityEnd = useCallback(() => sendActivitySignal('activity_end'), [sendActivitySignal]);

  /**
   * Ref-counted bracket hold for the shared lesson turn authority.
   *
   * A primitive running a gesture item needs the tutor to be silent, and the
   * only thing that delivers that is never closing a turn — prose asking the
   * model to wait cannot, because a closed turn owes a reply. The mic is NOT
   * touched (standing doctrine forbids a primitive muting it): capture keeps
   * running and the level meter stays live, we simply stop bracketing.
   *
   * Ref-counted because a lesson page can hold several primitives; the last
   * release wins, and every caller releases through the returned disposer.
   */
  const voiceTurnHoldsRef = useRef(0);
  const [voiceTurnsHeld, setVoiceTurnsHeld] = useState(false);
  const holdVoiceTurns = useCallback(() => {
    voiceTurnHoldsRef.current += 1;
    setVoiceTurnsHeld(true);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      voiceTurnHoldsRef.current = Math.max(0, voiceTurnHoldsRef.current - 1);
      if (voiceTurnHoldsRef.current === 0) setVoiceTurnsHeld(false);
    };
  }, []);

  const voiceTurnListenersRef = useRef(new Set<VoiceTurnListener>());
  const subscribeSharedVoiceTurns = useCallback((listener: VoiceTurnListener) => {
    voiceTurnListenersRef.current.add(listener);
    return () => voiceTurnListenersRef.current.delete(listener);
  }, []);
  const lessonVoiceTurns = useLiveVoiceTurnsWithTransport({
    enabled: isConnected && sessionMode === 'lesson' && isListening && !voiceTurnsHeld,
    config: resolveLessonVoiceTurnConfig(activePrimitiveType),
    onTurnOpen: (event) => {
      voiceTurnListenersRef.current.forEach((listener) => listener.onTurnOpen?.(event));
    },
    onTurnClose: (event) => {
      voiceTurnListenersRef.current.forEach((listener) => listener.onTurnClose?.(event));
    },
  }, {
    subscribeMicLevel,
    micFramePeriodMs,
    isTutorAudible: isAudioPlaying,
    sendActivityStart,
    sendActivityEnd,
  });

  // Signature of the last context update actually forwarded to Gemini. Used to
  // drop referentially-churned-but-value-identical updates (see updateContext).
  const lastContextSigRef = useRef<string>('');

  // Twin of the guard above, for the cue channel (see sendText).
  const lastCueRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });

  // Metrics tracking
  const [aiMetrics, setAIMetrics] = useState<AIMetrics>({
    totalHints: 0,
    totalInteractions: 0,
    conversationTurns: 0,
    voiceInteractions: 0,
    timeWithAI: 0,
    hintsGiven: {
      level1: 0,
      level2: 0,
      level3: 0,
    },
  });

  // Helper to build lesson context from exhibit data
  const buildLessonContext = useCallback((
    primitiveContext: PrimitiveContext,
    manifestItems: ManifestItem[],
    objectives: ObjectiveData[],
    evaluationResults?: any[]
  ): LessonContext => {
    // Find current primitive's position
    const currentIndex = manifestItems.findIndex(
      m => m.instanceId === primitiveContext.instance_id
    );

    // Build ordered components list
    const orderedComponents = manifestItems.map(item => ({
      component_id: item.componentId,
      instance_id: item.instanceId,
      title: item.title,
      objective_ids: item.objectiveIds,
    }));

    // Gather previous results if available
    const previousResults = evaluationResults
      ? evaluationResults
          .filter((_, idx) => idx < currentIndex)
          .map(r => ({
            instance_id: r.instanceId || '',
            component_id: r.componentId || '',
            completed: r.success || false,
            score: r.score,
          }))
      : [];

    return {
      exhibit_id: primitiveContext.exhibit_id || '',
      topic: primitiveContext.topic || 'Learning Activity',
      grade_level: primitiveContext.grade_level || 'K-6',
      objectives: objectives.map(obj => ({
        id: obj.id,
        text: obj.text,
        verb: obj.verb || 'learn',
      })),
      ordered_components: orderedComponents,
      current_index: currentIndex >= 0 ? currentIndex : 0,
      previous_results: previousResults,
    };
  }, []);

  // Shared WebSocket setup for both connect modes
  const setupSocket = useCallback((
    socket: WebSocket,
    onOpen: (socket: WebSocket) => void
  ) => {
    socket.onopen = () => {
      console.log('Lumina AI WebSocket connected');
      sessionStartTimeRef.current = Date.now();
      onOpen(socket);
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const messageType = message.type;

        if (messageType === 'ai_response') {
          setConversation(prev => [
            ...prev,
            {
              role: 'assistant',
              content: message.content,
              timestamp: Date.now(),
              isAudio: false,
            },
          ]);
          setIsAIResponding(false);
        } else if (messageType === 'ai_audio') {
          processAndPlayRawAudio(message.data, message.sampleRate || 24000);
        } else if (messageType === 'ai_transcription') {
          setConversation(prev => [
            ...prev,
            {
              role: 'assistant',
              content: message.content,
              timestamp: Date.now(),
              isAudio: true,
            },
          ]);
        } else if (messageType === 'user_transcription') {
          setConversation(prev => [
            ...prev,
            {
              role: 'user',
              content: message.content,
              timestamp: Date.now(),
              isAudio: true,
            },
          ]);
        } else if (messageType === 'ai_turn_end') {
          setIsAIResponding(false);
          resetForNextTurn();
        } else if (messageType === 'ai_interrupted') {
          // Gemini dropped the rest of its turn because the student spoke over
          // it (barge-in). The buffered tail is speech the model already
          // abandoned — flush it so isAudioPlaying falls with the model.
          stopAudioPlayback();
          setIsAIResponding(false);
        } else if (messageType === 'primitive_switched') {
          console.log(`Lumina AI: switched to ${message.primitive_type} (${message.instance_id})`);
          activePrimitiveIdRef.current = message.instance_id;
          setActivePrimitiveId(message.instance_id);
          // Server confirms only type + id; live data comes from our optimistic mirror.
          setActivePrimitiveType(message.primitive_type ?? null);
          setActivePrimitiveData(currentPrimitiveRef.current?.primitive_data ?? null);
        } else if (messageType === 'resumption_handle') {
          // Backend forwards Gemini's rolling resumption handle. Stash it so a
          // full client-socket drop can reconnect warm (server-side resumes are
          // transparent and don't need the client to do anything).
          if (message.handle) latestHandleRef.current = message.handle;
        } else if (messageType === 'session_resuming') {
          // Server is transparently reconnecting to Gemini on the SAME socket
          // (GoAway / drop). Not an end — drop any in-flight audio and keep going.
          console.log('Lumina AI resuming:', message.message);
          stopAudioPlayback();
          setIsAIResponding(false);
        } else if (messageType === 'session_resumed') {
          // Transparent server-side resume completed; conversation continues.
          // Also arrives when a warm client-socket reconnect lands (the
          // backend treats the auth-supplied handle as a resume), so this ONE
          // branch is the signal for both resume shapes. The bump is what lets
          // consumers re-cue work whose response died with the old connection.
          console.log('Lumina AI resumed:', message.message);
          setSessionEnded(false);
          setSessionEndedReason(null);
          setSessionResumeCount((count) => count + 1);
        } else if (messageType === 'session_ended') {
          // Server told us the Gemini session ended (usually the Live duration
          // limit). The socket close follows; flag it now so the UI flips to the
          // reconnect state immediately and any in-flight audio stops.
          console.log('Lumina AI session ended by server:', message.reason, message.message);
          setSessionEnded(true);
          setSessionEndedReason(message.reason ?? 'gemini_session_closed');
          setIsAIResponding(false);
          stopAudioPlayback();
        } else if (messageType === 'auth_success' || messageType === 'session_ready') {
          console.log('Lumina AI session ready:', message.message);
        }
      } catch (error) {
        console.error('Error handling Lumina AI message:', error);
      }
    };

    socket.onclose = (event) => {
      console.log('Lumina AI WebSocket closed:', event.code, event.reason);

      // Ignore a stale socket we've already swapped out (reconnect / re-auth) —
      // its late close must not tear down the freshly opened session.
      if (socketRef.current && socketRef.current !== socket) return;
      socketRef.current = null;

      setIsConnected(false);
      setSessionMode('idle');
      lessonModeRef.current = false;
      activePrimitiveIdRef.current = null;
      setActivePrimitiveId(null);
      setActivePrimitiveType(null);
      setActivePrimitiveData(null);
      lastContextSigRef.current = '';

      // Distinguish a deliberate close (disconnect / reconnect swap) from an
      // unexpected one. Only the latter should surface a reconnect affordance.
      // Tagged per-socket so a stale flag can't bleed across sessions.
      const intentional = (socket as unknown as { __intentionalClose?: boolean }).__intentionalClose === true;
      if (!intentional) {
        setSessionEnded(true);
        // Keep a reason already set by an explicit session_ended message.
        setSessionEndedReason(prev => prev ?? 'disconnected');
      }

      if (sessionStartTimeRef.current > 0) {
        const totalTime = Date.now() - sessionStartTimeRef.current;
        setAIMetrics(prev => ({ ...prev, timeWithAI: totalTime }));
      }
    };

    socket.onerror = (error) => {
      console.error('Lumina AI WebSocket error:', error);
    };
  }, [processAndPlayRawAudio, resetForNextTurn, stopAudioPlayback]);

  // Helper to close any existing socket
  const closeExistingSocket = useCallback(() => {
    if (socketRef.current) {
      const state = socketRef.current.readyState;
      if (state === WebSocket.CONNECTING || state === WebSocket.OPEN) {
        console.log('Lumina AI: closing existing socket before reconnecting');
        (socketRef.current as unknown as { __intentionalClose?: boolean }).__intentionalClose = true;
        socketRef.current.close(1000, 'Reconnecting');
      }
      socketRef.current = null;
    }
  }, []);

  // Helper to initialize audio service
  const ensureAudioService = useCallback(() => {
    if (!audioServiceRef.current) {
      audioServiceRef.current = new AudioCaptureService();
      audioServiceRef.current.setCallbacks({
        onStateChange: (state) => {
          setIsListening(state.isCapturing);
          // Capture stopped: publish the floor so every orb settles instead of
          // freezing on the last frame it happened to see.
          if (!state.isCapturing) publishMicLevel(0);
          // The audio context exists by the time capture starts, so the frame
          // period is knowable exactly here — never guessed downstream.
          if (state.isCapturing) {
            setMicFramePeriodMs(audioServiceRef.current?.getFramePeriodMs() ?? 0);
          }
        },
        onError: (error) => console.error('Audio capture error:', error),
        onAudioData: (frame) => {
          let sum = 0;
          for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
          publishMicLevel(frame.length ? Math.sqrt(sum / frame.length) : 0);
        },
      });
    }
  }, [publishMicLevel]);

  // Helper to get Firebase token
  const getFirebaseToken = useCallback(async (): Promise<string | null> => {
    try {
      const { getAuth } = await import('firebase/auth');
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      return token || null;
    } catch {
      return null;
    }
  }, []);

  // Standalone connect — one WebSocket per primitive (tester mode)
  const connect = useCallback(async (primitiveContext: PrimitiveContext) => {
    console.trace(`[LuminaAI] connect() called for ${primitiveContext.primitive_type}`);

    closeExistingSocket();

    const { objectives, manifestItems } = exhibitContextRef.current;
    const evalCtx = evaluationContextRef.current;

    currentPrimitiveRef.current = primitiveContext;
    lastConnectionRef.current = { mode: 'standalone', ctx: primitiveContext };
    setSessionEnded(false);
    setSessionEndedReason(null);
    ensureAudioService();

    const lessonContext = buildLessonContext(
      primitiveContext,
      manifestItems,
      objectives,
      evalCtx?.submittedResults
    );

    try {
      const wsBaseUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
      const wsUrl = `${wsBaseUrl}/api/lumina-tutor`;
      console.log(`Connecting to Lumina AI (standalone): ${wsUrl}`);

      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      setupSocket(socket, async () => {
        try {
          const token = await getFirebaseToken();
          if (!token) throw new Error('No authentication token available');
          if (socketRef.current !== socket) {
            (socket as unknown as { __intentionalClose?: boolean }).__intentionalClose = true;
            socket.close();
            return;
          }

          const componentDef = getComponentById(primitiveContext.primitive_type);

          // Consume any pending resume handle (set by reconnect) so this attempt
          // resumes warm; clear it so a later fresh connect starts cold.
          const resumeHandle = resumeWithHandleRef.current;
          resumeWithHandleRef.current = null;

          socket.send(JSON.stringify({
            type: 'authenticate',
            session_mode: 'standalone',
            token,
            client_run_id: getClientRunId(),
            resumption_handle: resumeHandle,
            primitive_context: {
              primitive_type: primitiveContext.primitive_type,
              instance_id: primitiveContext.instance_id,
              primitive_data: primitiveContext.primitive_data,
              tutoring: primitiveContext.tutoring ?? componentDef?.tutoring ?? null,
              audio_input: primitiveContext.audio_input ?? componentDef?.audioInput ?? null,
              // DI-GREET-1: suppresses the backend's improvised greeting turn so
              // the pack's own scripted cue is the first thing the child hears.
              owns_opening: primitiveContext.owns_opening ?? false,
            },
            lesson_context: lessonContext,
            student_progress: {
              attempts: 0,
              hints_used: 0,
              success_rate: 0,
            },
          }));

          if (audioServiceRef.current) {
            audioServiceRef.current.setWebSocket(socket);
          }

          setIsConnected(true);
          setSessionMode('standalone');
          activePrimitiveIdRef.current = primitiveContext.instance_id;
          setActivePrimitiveId(primitiveContext.instance_id);
          setActivePrimitiveType(primitiveContext.primitive_type);
          setActivePrimitiveData(primitiveContext.primitive_data ?? null);
          console.log('Lumina AI authenticated (standalone)');
        } catch (error) {
          console.error('Error authenticating Lumina AI:', error);
          (socket as unknown as { __intentionalClose?: boolean }).__intentionalClose = true;
          socket.close();
          setIsConnected(false);
        }
      });

    } catch (error) {
      console.error('Error connecting to Lumina AI:', error);
      setIsConnected(false);
    }
  }, [buildLessonContext, setupSocket, closeExistingSocket, ensureAudioService, getFirebaseToken]);

  // Lesson connect — one WebSocket for the entire exhibit
  const connectLesson = useCallback(async (info: LessonConnectionInfo) => {
    console.log(`[LuminaAI] connectLesson() called for exhibit ${info.exhibit_id}`);

    // Claim lesson mode synchronously (before any await) so primitives mounting
    // in the same commit don't standalone-connect and clobber this session.
    lessonModeRef.current = true;

    closeExistingSocket();

    currentPrimitiveRef.current = info.firstPrimitive;
    lastConnectionRef.current = { mode: 'lesson', info };
    setSessionEnded(false);
    setSessionEndedReason(null);
    ensureAudioService();

    const { objectives, manifestItems } = exhibitContextRef.current;
    const evalCtx = evaluationContextRef.current;

    const lessonContext = buildLessonContext(
      info.firstPrimitive,
      manifestItems,
      objectives,
      evalCtx?.submittedResults
    );

    try {
      const wsBaseUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
      const wsUrl = `${wsBaseUrl}/api/lumina-tutor`;
      console.log(`Connecting to Lumina AI (lesson): ${wsUrl}`);

      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      setupSocket(socket, async () => {
        try {
          const token = await getFirebaseToken();
          if (!token) throw new Error('No authentication token available');
          if (socketRef.current !== socket) {
            (socket as unknown as { __intentionalClose?: boolean }).__intentionalClose = true;
            socket.close();
            return;
          }

          const componentDef = getComponentById(info.firstPrimitive.primitive_type);

          // Gemini's audio-input mode is fixed at session creation. Every
          // lesson now uses manual activity because the provider owns the one
          // shared turn authority; catalog fields may still contribute tuning.
          const declaredAudioInput = info.firstPrimitive.audio_input
            ?? manifestItems
              .map((item) => getComponentById(item.componentId)?.audioInput)
              .find(Boolean)
            ?? {};
          const lessonAudioInput = resolveLessonAudioInput(declaredAudioInput);

          // Consume any pending resume handle (set by reconnect) so this attempt
          // resumes warm; clear it so a later fresh connect starts cold.
          const resumeHandle = resumeWithHandleRef.current;
          resumeWithHandleRef.current = null;

          socket.send(JSON.stringify({
            type: 'authenticate',
            session_mode: 'lesson',
            token,
            client_run_id: getClientRunId(),
            resumption_handle: resumeHandle,
            primitive_context: {
              primitive_type: info.firstPrimitive.primitive_type,
              instance_id: info.firstPrimitive.instance_id,
              primitive_data: info.firstPrimitive.primitive_data,
              tutoring: info.firstPrimitive.tutoring ?? componentDef?.tutoring ?? null,
              audio_input: lessonAudioInput,
            },
            lesson_context: lessonContext,
            student_progress: {
              attempts: 0,
              hints_used: 0,
              success_rate: 0,
            },
          }));

          if (audioServiceRef.current) {
            audioServiceRef.current.setWebSocket(socket);
          }

          setIsConnected(true);
          setSessionMode('lesson');
          activePrimitiveIdRef.current = info.firstPrimitive.instance_id;
          setActivePrimitiveId(info.firstPrimitive.instance_id);
          setActivePrimitiveType(info.firstPrimitive.primitive_type);
          setActivePrimitiveData(info.firstPrimitive.primitive_data ?? null);
          console.log('Lumina AI authenticated (lesson mode)');
        } catch (error) {
          console.error('Error authenticating Lumina AI (lesson):', error);
          (socket as unknown as { __intentionalClose?: boolean }).__intentionalClose = true;
          socket.close();
          setIsConnected(false);
        }
      });

    } catch (error) {
      console.error('Error connecting to Lumina AI (lesson):', error);
      setIsConnected(false);
    }
  }, [buildLessonContext, setupSocket, closeExistingSocket, ensureAudioService, getFirebaseToken]);

  // Re-establish the most recent session after an unexpected end. Re-runs the
  // exact connect path that was used originally (lesson re-greets; standalone
  // re-auths), reusing the stored connection info.
  const reconnect = useCallback(async () => {
    const last = lastConnectionRef.current;
    if (!last) {
      console.warn('Lumina AI: reconnect() called with no prior session to restore');
      return;
    }
    // Resume warm: hand the latest Gemini handle to the next connect attempt so
    // the conversation continues instead of re-greeting from scratch.
    resumeWithHandleRef.current = latestHandleRef.current;
    console.log(`[LuminaAI] reconnect() (${last.mode}, warm=${!!resumeWithHandleRef.current})`);
    if (last.mode === 'lesson') {
      await connectLesson(last.info);
    } else {
      await connect(last.ctx);
    }
  }, [connect, connectLesson]);

  // Switch the active primitive within a lesson session (no new WebSocket).
  // Interrupts by default: the student has left the screen the tutor is
  // describing, so finishing that sentence is worth nothing to them. Pass
  // interrupt: false for a navigation where the current thought still applies.
  const switchPrimitive = useCallback((
    primitiveContext: PrimitiveContext,
    options?: { interrupt?: boolean },
  ) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      console.warn('Cannot switch primitive: not connected');
      return;
    }

    // Skip if already on this primitive — avoids redundant WebSocket messages
    if (primitiveContext.instance_id === activePrimitiveIdRef.current) {
      return;
    }

    console.log(`[LuminaAI] switchPrimitive() to ${primitiveContext.primitive_type} (${primitiveContext.instance_id})`);

    currentPrimitiveRef.current = primitiveContext;

    const componentDef = getComponentById(primitiveContext.primitive_type);

    socketRef.current.send(JSON.stringify({
      type: 'switch_primitive',
      interrupt: options?.interrupt ?? true,
      primitive_context: {
        primitive_type: primitiveContext.primitive_type,
        instance_id: primitiveContext.instance_id,
        primitive_data: primitiveContext.primitive_data,
        tutoring: componentDef?.tutoring ?? null,
        // Informational carry — Gemini's audio config is fixed at session
        // creation (connectLesson already scanned the manifest and applied it),
        // but the backend sees what the incoming primitive would have asked for.
        audio_input: componentDef?.audioInput ?? null,
      },
    }));

    // Optimistically set active — server will confirm via primitive_switched
    activePrimitiveIdRef.current = primitiveContext.instance_id;
    setActivePrimitiveId(primitiveContext.instance_id);
    setActivePrimitiveType(primitiveContext.primitive_type);
    setActivePrimitiveData(primitiveContext.primitive_data ?? null);
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      (socketRef.current as unknown as { __intentionalClose?: boolean }).__intentionalClose = true;
      socketRef.current.close(1000, 'Manual disconnect');
      socketRef.current = null;
    }

    if (audioServiceRef.current) {
      audioServiceRef.current.destroy();
      audioServiceRef.current = null;
    }

    stopAudioPlayback();

    setIsConnected(false);
    setSessionMode('idle');
    lessonModeRef.current = false;
    activePrimitiveIdRef.current = null;
    setActivePrimitiveId(null);
    setConversation([]);
    lastContextSigRef.current = '';
    // User-initiated end: drop the resumption handles so the next connect starts
    // a fresh conversation rather than resuming this one.
    latestHandleRef.current = null;
    resumeWithHandleRef.current = null;
    // Not an unexpected drop, so clear the reconnect flag.
    setSessionEnded(false);
    setSessionEndedReason(null);

    if (sessionStartTimeRef.current > 0) {
      const totalTime = Date.now() - sessionStartTimeRef.current;
      setAIMetrics(prev => ({ ...prev, timeWithAI: totalTime }));
    }
  }, [stopAudioPlayback]);

  const requestHint = useCallback((level: 1 | 2 | 3, currentState?: any) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      console.warn('Cannot request hint: not connected');
      return;
    }

    setIsAIResponding(true);

    setAIMetrics(prev => ({
      ...prev,
      totalHints: prev.totalHints + 1,
      totalInteractions: prev.totalInteractions + 1,
      hintsGiven: {
        ...prev.hintsGiven,
        [`level${level}`]: prev.hintsGiven[`level${level}` as keyof typeof prev.hintsGiven] + 1,
      },
    }));

    setConversation(prev => [
      ...prev,
      {
        role: 'user',
        content: `Requested Level ${level} hint`,
        timestamp: Date.now(),
        isAudio: false,
      },
    ]);

    const state = currentState || currentPrimitiveRef.current?.primitive_data;
    let content = `The student is requesting a Level ${level} hint. ${HINT_GUIDANCE[level]}`;
    if (state && Object.keys(state).length > 0) {
      content += `\n\nCurrent state: ${JSON.stringify(state)}`;
    }

    socketRef.current.send(JSON.stringify({
      type: 'text',
      content,
      // The student pressed a button and is waiting on the answer — that
      // outranks finishing the sentence in progress.
      interrupt: true,
    }));
  }, []);

  const sendVoice = useCallback((audioData: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      console.warn('Cannot send voice: not connected');
      return;
    }

    setAIMetrics(prev => ({
      ...prev,
      voiceInteractions: prev.voiceInteractions + 1,
      conversationTurns: prev.conversationTurns + 1,
      totalInteractions: prev.totalInteractions + 1,
    }));

    setIsAIResponding(true);

    socketRef.current.send(JSON.stringify({
      type: 'audio',
      data: audioData,
    }));
  }, []);

  // `interrupt` says whether this message may cut the tutor off mid-sentence.
  // The server never guesses: by default a cue waits for the current turn to
  // end and rides out with whatever else piled up. Pass interrupt: true only
  // when finishing the sentence is worth nothing to the student — they left
  // the screen it describes, or they pressed something and are waiting on it.
  // `scripted` declares that every word the model should speak is already in
  // this cue (a judged pack's say-exactly line), so the server must not prepend
  // its [CURRENT STATE] block — the Live model narrates that preamble aloud,
  // target answer included (ten-frame DI drive, 2026-08-14). Per message, like
  // `interrupt`: only the caller knows whether its cue is self-contained.
  const sendText = useCallback((text: string, options?: { silent?: boolean; interrupt?: boolean; scripted?: boolean }) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      console.warn('Cannot send text: not connected');
      return;
    }

    // Dedup identical cues landing in the same tick — the cue-channel twin of
    // updateContext's signature guard below. A cue is a side effect, and a
    // primitive that fires one from inside a state updater emits it twice under
    // StrictMode; the duplicate then barges in on the turn the first copy just
    // started, clipping the tutor mid-sentence. A real session shipped every
    // [ANSWER_CORRECT] twice this way (2026-08-06 review). Guarding here covers
    // every primitive — several send from inside updaters today, and the next
    // one written that way is fixed on arrival.
    const now = Date.now();
    if (text === lastCueRef.current.text && now - lastCueRef.current.at < DUPLICATE_CUE_WINDOW_MS) {
      console.warn('[LuminaAI] Dropped duplicate cue within the same tick:', text.slice(0, 80));
      return;
    }
    lastCueRef.current = { text, at: now };

    if (!options?.silent) {
      setAIMetrics(prev => ({
        ...prev,
        conversationTurns: prev.conversationTurns + 1,
        totalInteractions: prev.totalInteractions + 1,
      }));

      setConversation(prev => [
        ...prev,
        {
          role: 'user',
          content: text,
          timestamp: Date.now(),
          isAudio: false,
        },
      ]);

      setIsAIResponding(true);
    }

    socketRef.current.send(JSON.stringify({
      type: 'text',
      content: text,
      interrupt: options?.interrupt ?? false,
      scripted: options?.scripted ?? false,
    }));
  }, []);

  const updateContext = useCallback((newState: any, progress?: any) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    // Always keep our local mirror of primitive_data current, even when we end
    // up not forwarding this particular update to Gemini.
    if (currentPrimitiveRef.current) {
      currentPrimitiveRef.current.primitive_data = {
        ...currentPrimitiveRef.current.primitive_data,
        ...newState,
      };
    }

    // Drop static lesson/identity framing — only genuine interaction state is a
    // real "context update".
    const dynamicState: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(newState || {})) {
      if (STATIC_CONTEXT_KEYS.has(k)) continue;
      dynamicState[k] = v;
    }

    // Nothing meaningful left to report.
    if (Object.keys(dynamicState).length === 0 && !progress) {
      return;
    }

    // Dedup by value, scoped to the active primitive. Parent re-renders (e.g. on
    // every AI transcription chunk) hand primitives a fresh data object with
    // unchanged values; without this guard each one would forward an identical
    // [CONTEXT UPDATE], creating a transcription -> render -> update feedback loop.
    const signature = JSON.stringify({
      id: activePrimitiveIdRef.current,
      state: dynamicState,
      progress: progress ?? null,
    });
    if (signature === lastContextSigRef.current) {
      return;
    }
    lastContextSigRef.current = signature;

    // Surface the merged live data to the CuratorConsole so its next-step button
    // labels/visibility re-interpolate. Only runs when state genuinely changed
    // (past the dedup guard above), so it adds no render churn on idle re-renders.
    if (currentPrimitiveRef.current) {
      setActivePrimitiveData({ ...currentPrimitiveRef.current.primitive_data });
    }

    socketRef.current.send(JSON.stringify({
      type: 'update_context',
      primitive_data: dynamicState,
      student_progress: progress,
    }));
  }, []);

  const startListening = useCallback(() => {
    if (audioServiceRef.current && socketRef.current) {
      void audioServiceRef.current.startCapture().catch((error) => {
        console.error('Unable to start Lumina microphone:', error);
      });
    }
  }, []);

  const stopListening = useCallback(() => {
    if (audioServiceRef.current) {
      audioServiceRef.current.stopCapture();
    }
  }, []);

  // Open one persistent mic when the shared lesson socket becomes ready. This
  // does not key on isListening, so an explicit pause remains paused.
  useEffect(() => {
    if (!isConnected || sessionMode !== 'lesson') return;
    ensureAudioService();
    void audioServiceRef.current?.startCapture().catch((error) => {
      console.error('Unable to open the lesson microphone:', error);
    });
  }, [ensureAudioService, isConnected, sessionMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        (socketRef.current as unknown as { __intentionalClose?: boolean }).__intentionalClose = true;
        socketRef.current.close();
      }
      if (audioServiceRef.current) {
        audioServiceRef.current.destroy();
      }
      stopAudioPlayback();
    };
  }, [stopAudioPlayback]);

  const value: LuminaAIContextType = {
    connect,
    connectLesson,
    switchPrimitive,
    disconnect,
    reconnect,
    isConnected,
    sessionMode,
    sessionEnded,
    sessionEndedReason,
    sessionResumeCount,
    lessonModeRef,
    activePrimitiveId,
    activePrimitiveType,
    activePrimitiveData,
    requestHint,
    sendVoice,
    sendText,
    updateContext,
    conversation,
    isAIResponding,
    isAudioPlaying,
    aiMetrics,
    startListening,
    stopListening,
    isListening,
    holdVoiceTurns,
    subscribeMicLevel,
    micLevelRef,
    micFramePeriodMs,
    sendActivityStart,
    sendActivityEnd,
    sharedVoiceTurns: {
      ...lessonVoiceTurns,
      subscribe: subscribeSharedVoiceTurns,
    },
  };

  return (
    <LuminaAIContext.Provider value={value}>
      {children}
    </LuminaAIContext.Provider>
  );
};

export const useLuminaAIContext = () => {
  const context = useContext(LuminaAIContext);
  if (!context) {
    throw new Error('useLuminaAIContext must be used within a LuminaAIProvider');
  }
  return context;
};

/**
 * The live mic RMS as state — for surfaces that PAINT it (the mic orb's spike
 * ring, Pip's halo, the bench's RMS readout).
 *
 * Call it in the smallest component that draws the level, never in a primitive
 * that merely contains one: it re-renders its caller once per audio frame, and
 * that render is the cost item 19b exists to keep from spreading. Everything
 * that only needs the value at some other moment reads `ctx.micLevelRef.current`
 * instead, and everything that consumes the level as a SIGNAL (the turn machine)
 * subscribes directly and never renders at all.
 */
export const useMicLevel = (): number => {
  const { subscribeMicLevel, micLevelRef } = useLuminaAIContext();
  const [level, setLevel] = useState(() => micLevelRef.current);
  useEffect(() => {
    // Frames may have flowed between the initial read and this subscribe.
    setLevel(micLevelRef.current);
    return subscribeMicLevel(setLevel);
  }, [subscribeMicLevel, micLevelRef]);
  return level;
};
