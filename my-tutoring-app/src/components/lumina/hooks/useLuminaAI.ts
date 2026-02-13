import { useEffect, useRef } from 'react';
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
 * Automatically connects when the primitive mounts and disconnects when it unmounts.
 * Updates the AI context when primitive data changes.
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
  // Synchronous flag to prevent duplicate async connect calls
  const isConnectingRef = useRef(false);

  // Stabilize instanceId — callers often use `id || \`prefix-${Date.now()}\`` which
  // produces a new string every render, triggering the connect effect in a loop.
  // Capture the first value and reuse it for the lifetime of this hook instance.
  const stableInstanceIdRef = useRef(instanceId);

  // Stable ref for context — avoids re-triggering effects when provider state changes
  const contextRef = useRef(context);
  contextRef.current = context;

  // Auto-connect when primitive mounts
  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Guard against both completed connections AND in-flight async connects
    if (hasConnectedRef.current || isConnectingRef.current) {
      return;
    }

    let cancelled = false;

    const connectAI = async () => {
      // DEBUG: trace who triggers connection
      console.trace(`[useLuminaAI] connectAI() called for ${primitiveType} (${instanceId})`);

      // Set synchronous flag BEFORE any awaits to prevent races
      isConnectingRef.current = true;

      try {
        // Get student ID from auth
        const { getAuth } = await import('firebase/auth');

        // Check if effect was cleaned up during the await
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

        // For now, use UID as student_id (you may need to map this)
        const studentId = parseInt(user.uid.substring(0, 8), 16); // Convert first 8 chars of UID to number

        if (cancelled) {
          isConnectingRef.current = false;
          return;
        }

        await contextRef.current.connect({
          primitive_type: primitiveType,
          instance_id: stableInstanceIdRef.current,
          primitive_data: primitiveData,
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

    // Cleanup: disconnect when component unmounts
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

  // Auto-update context when primitive state changes (but don't reconnect)
  useEffect(() => {
    if (contextRef.current.isConnected && hasConnectedRef.current) {
      // Debounce updates to avoid spamming the server
      const timeoutId = setTimeout(() => {
        contextRef.current.updateContext(primitiveData);
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [primitiveData]);

  return {
    // AI interaction methods
    requestHint: context.requestHint,
    sendVoice: context.sendVoice,
    sendText: context.sendText,
    startListening: context.startListening,
    stopListening: context.stopListening,

    // State
    isConnected: context.isConnected,
    isAIResponding: context.isAIResponding,
    isListening: context.isListening,
    conversation: context.conversation,

    // Metrics (for evaluation integration)
    aiMetrics: context.aiMetrics,
  };
}
