'use client';

import { useEffect, useRef, useState } from 'react';

/** True while the tutor is speaking an utterance that STARTED on this scope.
 * Classic primitives have no cue id, so the rising edge of audio is the cue:
 * praise still playing after "Next" belongs to the previous item and never
 * makes Pip point into the new one.
 */
export function useSpeechScope(scopeId: string | null, speaking: boolean): boolean {
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const wasSpeaking = useRef(false);
  useEffect(() => {
    if (speaking && !wasSpeaking.current) setOpenedFor(scopeId);
    wasSpeaking.current = speaking;
  }, [speaking, scopeId]);
  return speaking && scopeId !== null && openedFor === scopeId;
}
