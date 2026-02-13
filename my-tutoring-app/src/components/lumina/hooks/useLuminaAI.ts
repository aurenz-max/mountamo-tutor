import { useEffect, useRef, useCallback } from 'react';
import { useLuminaAIContext } from '@/contexts/LuminaAIContext';
import type { ComponentId } from '../types';

export interface UseLuminaAIOptions {
  primitiveType: ComponentId;
  instanceId: string;
  primitiveData: any;
  enabled?: boolean;
  exhibitId?: string;
  topic?: string;
  gradeLevel?: string;
}

/**
 * Hook for primitives to access Lumina AI assistance.
 *
 * Mode-aware behavior:
 * - **lesson mode**: Does NOT connect/disconnect. Calls switchPrimitive() on mount
 *   to tell the existing session about this primitive. On unmount, does nothing
 *   (the session belongs to the lesson, not the primitive).
 * - **standalone mode / idle**: Auto-connects on mount, disconnects on unmount
 *   (original behavior for testers).
 *
 * Implicit activation: calling sendText or requestHint from a non-active primitive
 * in lesson mode will automatically switch to this primitive first.
 *
 * @example
 * const { requestHint, aiMetrics, isConnected } = useLuminaAI({
 *   primitiveType: 'phonics-blender',
 *   instanceId: data.instanceId!,
 *   primitiveData: {
 *     patternType: data.patternType,
 *     currentWord: currentWord,
 *     targetPhonemes: data.targetPhonemes,
 *     gradeLevel: data.gradeLevel
 *   }
 * });
 */
export function useLuminaAI({
  primitiveType,
  instanceId,
  primitiveData,
  enabled = true,
  exhibitId,
  topic,
  gradeLevel,
}: UseLuminaAIOptions) {
  const context = useLuminaAIContext();
  const hasConnectedRef = useRef(false);
  const isConnectingRef = useRef(false);
  // Track whether lesson-mode switch has been done for this primitive
  const hasLessonSwitchedRef = useRef(false);

  // Stabilize instanceId — callers often use `id || \`prefix-${Date.now()}\`` which
  // produces a new string every render, triggering the connect effect in a loop.
  const stableInstanceIdRef = useRef(instanceId);

  // Stable ref for context — avoids re-triggering effects when provider state changes
  const contextRef = useRef(context);
  contextRef.current = context;

  // Stable ref for primitiveData to use in ensureActive without triggering effects
  const primitiveDataRef = useRef(primitiveData);
  primitiveDataRef.current = primitiveData;

  // Effect 1: Standalone auto-connect (testers, backward compat)
  // Only runs when sessionMode is idle — reads mode from ref to avoid dep cycle.
  useEffect(() => {
    if (!enabled) return;

    const ctx = contextRef.current;

    // If a lesson session is active or pending, don't auto-connect
    if (ctx.sessionMode === 'lesson') return;

    // Guard against duplicate connects
    if (hasConnectedRef.current || isConnectingRef.current) return;

    let cancelled = false;
    const stableId = stableInstanceIdRef.current;

    const connectAI = async () => {
      console.trace(`[useLuminaAI] connectAI() called for ${primitiveType} (${stableId})`);
      isConnectingRef.current = true;

      try {
        const { getAuth } = await import('firebase/auth');
        if (cancelled) {
          isConnectingRef.current = false;
          return;
        }

        const auth = getAuth();
        const user = auth.currentUser;

        if (!user) {
          console.warn('No authenticated user for Lumina AI');
          isConnectingRef.current = false;
          return;
        }

        const studentId = parseInt(user.uid.substring(0, 8), 16);

        if (cancelled) {
          isConnectingRef.current = false;
          return;
        }

        await contextRef.current.connect({
          primitive_type: primitiveType,
          instance_id: stableId,
          primitive_data: primitiveDataRef.current,
          student_id: studentId,
          exhibit_id: exhibitId,
          topic: topic,
          grade_level: gradeLevel,
        });

        if (!cancelled) {
          hasConnectedRef.current = true;
          console.log(`Lumina AI connected for ${primitiveType}`);
        }
      } catch (error) {
        console.error('Error connecting Lumina AI:', error);
      } finally {
        isConnectingRef.current = false;
      }
    };

    connectAI();

    // Cleanup: disconnect when component unmounts (standalone only)
    return () => {
      cancelled = true;
      isConnectingRef.current = false;

      if (hasConnectedRef.current) {
        contextRef.current.disconnect();
        hasConnectedRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, primitiveType, exhibitId, topic, gradeLevel]);

  // Effect 2: Lesson-mode activation
  // Watches for session becoming 'lesson' + connected, then switches primitive.
  // No cleanup — lesson session is owned by LessonAIBootstrap, not this hook.
  useEffect(() => {
    if (!enabled) return;
    if (context.sessionMode !== 'lesson' || !context.isConnected) return;
    if (hasLessonSwitchedRef.current) return;

    const stableId = stableInstanceIdRef.current;
    console.log(`[useLuminaAI] Lesson mode ready — switching to ${primitiveType} (${stableId})`);

    contextRef.current.switchPrimitive({
      primitive_type: primitiveType,
      instance_id: stableId,
      primitive_data: primitiveDataRef.current,
      exhibit_id: exhibitId,
      topic: topic,
      grade_level: gradeLevel,
    });
    hasConnectedRef.current = true;
    hasLessonSwitchedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, primitiveType, context.sessionMode, context.isConnected]);

  // Reset lesson switch flag on unmount so remounting triggers a fresh switch
  useEffect(() => {
    return () => {
      hasLessonSwitchedRef.current = false;
    };
  }, []);

  // Auto-update context when primitive state changes (but don't reconnect)
  // In lesson mode, only send updates if this primitive is the active one
  useEffect(() => {
    const ctx = contextRef.current;
    if (!ctx.isConnected || !hasConnectedRef.current) return;

    // In lesson mode, skip context updates from non-active primitives
    if (ctx.sessionMode === 'lesson' && ctx.activePrimitiveId !== stableInstanceIdRef.current) {
      return;
    }

    // Debounce updates to avoid spamming the server
    const timeoutId = setTimeout(() => {
      contextRef.current.updateContext(primitiveData);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [primitiveData]);

  // Implicit activation: ensure this primitive is active before interacting
  const ensureActive = useCallback(() => {
    const ctx = contextRef.current;
    if (ctx.sessionMode === 'lesson' && ctx.activePrimitiveId !== stableInstanceIdRef.current) {
      ctx.switchPrimitive({
        primitive_type: primitiveType,
        instance_id: stableInstanceIdRef.current,
        primitive_data: primitiveDataRef.current,
        exhibit_id: exhibitId,
        topic: topic,
        grade_level: gradeLevel,
      });
    }
  }, [primitiveType, exhibitId, topic, gradeLevel]);

  // Wrapped sendText with implicit activation
  const sendText = useCallback((text: string, options?: { silent?: boolean }) => {
    ensureActive();
    contextRef.current.sendText(text, options);
  }, [ensureActive]);

  // Wrapped requestHint with implicit activation
  const requestHint = useCallback((level: 1 | 2 | 3, currentState?: any) => {
    ensureActive();
    contextRef.current.requestHint(level, currentState);
  }, [ensureActive]);

  return {
    // AI interaction methods (with implicit activation wrappers)
    requestHint,
    sendVoice: context.sendVoice,
    sendText,
    startListening: context.startListening,
    stopListening: context.stopListening,

    // State
    isConnected: context.isConnected,
    isAIResponding: context.isAIResponding,
    isListening: context.isListening,
    conversation: context.conversation,

    // Session info
    sessionMode: context.sessionMode,
    activePrimitiveId: context.activePrimitiveId,

    // Metrics (for evaluation integration)
    aiMetrics: context.aiMetrics,
  };
}
